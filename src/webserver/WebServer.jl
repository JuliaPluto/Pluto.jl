import MsgPack
import UUIDs: UUID
import HTTP
import Sockets
import .PkgCompat

function open_in_default_browser(url::AbstractString)::Bool
    try
        if Sys.isapple()
            Base.run(`open $url`)
            true
        elseif Sys.iswindows() || detectwsl()
            Base.run(`powershell.exe Start "'$url'"`)
            true
        elseif Sys.islinux()
            Base.run(`xdg-open $url`, devnull, devnull, devnull)
            true
        else
            false
        end
    catch ex
        false
    end
end

function swallow_exception(f, exception_type::Type{T}) where {T}
    try
        f()
    catch e
        isa(e, T) || rethrow(e)
    end
end

"""
The raw bytes of an in-memory response body. Pluto's handlers build responses
from strings or byte vectors, so depending on the constructor the body ends up
as an `HTTP.BytesBody`, a `Vector{UInt8}`, a `String`, or `HTTP.EmptyBody`.
"""
response_body_bytes(body::HTTP.BytesBody) = body.data
response_body_bytes(body::AbstractVector{UInt8}) = body
response_body_bytes(body::AbstractString) = codeunits(body)
response_body_bytes(::HTTP.EmptyBody) = UInt8[]

"""
    Pluto.run()

Start Pluto!

## Keyword arguments
You can configure some of Pluto's more technical behaviour using keyword arguments, but this is mostly meant to support testing and strange setups like Docker. If you want to do something exciting with Pluto, you can probably write a creative notebook to do it!

    Pluto.run(; kwargs...)

For the full list, see the [`Pluto.Configuration`](@ref) module. Some **common parameters**:

- `launch_browser`: Optional. Whether to launch the system default browser. Disable this on SSH and such.
- `host`: Optional. The default `host` is `"127.0.0.1"`. For wild setups like Docker and heroku, you might need to change this to `"0.0.0.0"`.
- `port`: Optional. The default `port` is `1234`.
- `auto_reload_from_file`: Reload when the `.jl` file is modified. The default is `false`.

## Technobabble

This will start the static HTTP server and a WebSocket server. The server runs _synchronously_ (i.e. blocking call) on `http://[host]:[port]/`.
Pluto notebooks can be started from the main menu in the web browser.
"""
function run(; kwargs...)
    options = Configuration.from_flat_kwargs(; kwargs...)
    run(options)
end

function run(options::Configuration.Options)
    session = ServerSession(; options)
    run(session)
end

const is_first_run = Ref(true)

"Return a port and serversocket to use while taking into account the `favourite_port`."
function port_serversocket(hostIP::Sockets.IPAddr, favourite_port, port_hint)
    listen_on(port) = HTTP.TCP.listen("tcp", HTTP.HostResolvers.join_host_port(string(hostIP), Int(port)))
    if favourite_port === nothing
        port = UInt16(port_hint)
        while true
            serversocket = try
                listen_on(port)
            catch e
                port == typemax(UInt16) && rethrow()
                port += UInt16(1)
                continue
            end
            return port, serversocket
        end
    else
        port = UInt16(favourite_port)
        serversocket = try
            listen_on(port)
        catch e
            error("Cannot listen on port $port. It may already be in use, or you may not have sufficient permissions. Use Pluto.run() to automatically select an available port.")
        end
        return port, serversocket
    end
end

struct RunningPlutoServer
    http_server
    on_shutdown::Function
    initial_registry_update_task::Task
end

function Base.close(ssc::RunningPlutoServer)
    # Close client connections and shut down notebooks first: the graceful
    # `close(::HTTP.Server)` waits for active (WebSocket) connections to finish.
    ssc.on_shutdown()
    close(ssc.http_server)
    wait(ssc.http_server)
    wait(ssc.initial_registry_update_task)
end

function Base.wait(ssc::RunningPlutoServer)
    try
        # create blocking call and switch the scheduler back to the server task, so that interrupts land there
        while isopen(ssc.http_server)
            sleep(.1)
        end
    catch e
        println()
        println()
        (e isa InterruptException) || rethrow(e)
    finally
        Base.close(ssc)
    end

    nothing
end

"""
    run(session::ServerSession)

Specifiy the [`Pluto.ServerSession`](@ref) to run the web server on, which includes the configuration. Passing a session as argument allows you to start the web server with some notebooks already running. See [`SessionActions`](@ref) to learn more about manipulating a `ServerSession`.
"""
function run(session::ServerSession)
    Base.wait(run!(session))
end

function run!(session::ServerSession)
    if is_first_run[]
        is_first_run[] = false
        @info "Loading..."
    end
    if !session.options.security.require_secret_for_open_links
        @warn "Dangerous setting:\n\n\trequire_secret_for_open_links = false\n\nDo not use this setting on your own computer – it allows any website to run arbitrary code on your computer. Only use this on an isolated disposable server like Binder, or when using your own authentication layer."
    end
        
    warn_julia_compat()

    pluto_router = http_router_for(session)
    store_session_middleware = create_session_context_middleware(session)
    app = pluto_router |> auth_middleware |> store_session_middleware

    let n = session.options.server.notebook
        SessionActions.open.((session,), 
            n === nothing ? [] : 
            n isa AbstractString ? [n] : 
            n;
            run_async=true,
        )
    end

    host = session.options.server.host
    hostIP = parse(Sockets.IPAddr, host)
    favourite_port = session.options.server.port
    port_hint = session.options.server.port_hint

    local port, serversocket = port_serversocket(hostIP, favourite_port, port_hint)

    on_shutdown() = @sync begin
        @info("\nClosing Pluto... Restart Julia for a fresh session. \n\nHave a nice day! 🎈\n\n")
        # TODO: put do_work tokens back
        for client in values(session.connected_clients)
            @async swallow_exception(() -> close(client.stream), Exception)
        end
        empty!(session.connected_clients)
        for nb in values(session.notebooks)
            @asynclog SessionActions.shutdown(session, nb; keep_in_session=false, async=false, verbose=false)
        end
    end

    server = HTTP.listen!(serversocket) do http::HTTP.Stream
        # the if statement below asks if the current request is a "websocket upgrade" request: the start of a websocket connection.
        if HTTP.WebSockets.isupgrade(http.message)
            secret_required = let
                s = session.options.security
                s.require_secret_for_access || s.require_secret_for_open_links
            end
            finish() = try
                HTTP.setstatus(http, 403)
                HTTP.startwrite(http)
                write(http, "Forbidden")
                HTTP.closewrite(http)
            catch e
                if !(e isa Base.IOError)
                    rethrow(e)
                end
            end
            if !secret_required || is_authenticated(session, http.message)
                try
                    # "upgrade" means accept and start the websocket connection that the client requested
                    # Origin checking is disabled (like HTTP.jl 1.x) because it breaks proxied setups (Binder, JupyterHub); Pluto's own secret provides the authentication.
                    HTTP.WebSockets.upgrade(http; check_origin=(request, origin) -> true) do clientstream
                        if HTTP.WebSockets.isclosed(clientstream)
                            return
                        end
                        found_client_id_ref = Ref(Symbol(:none))
                        try
                            # the loop below will keep running for this websocket connection, it iterates over all incoming websocket messages.
                            for message in clientstream
                                # This stream contains data received over the WebSocket.
                                # It is formatted and MsgPack-encoded by send(...) in PlutoConnection.js
                                local parentbody = nothing
                                local did_read = false
                                try
                                    parentbody = unpack(message)
                                    
                                    # for debug only
                                    let
                                        lag = session.options.server.simulated_lag
                                        (lag > 0) && sleep(lag * (0.5 + rand())) # sleep(0) would yield to the process manager which we dont want
                                    end
                                    
                                    did_read = true
                                    if found_client_id_ref[] === :none
                                        found_client_id_ref[] = Symbol(parentbody["client_id"])
                                    end
                                    process_ws_message(session, parentbody, clientstream)
                                catch ex
                                    if ex isa InterruptException || ex isa HTTP.WebSockets.WebSocketError || ex isa EOFError
                                        # that's fine!
                                    else
                                        bt = catch_backtrace()
                                        if did_read
                                            @warn "Processing message failed for unknown reason:" parentbody exception = (ex, bt)
                                        else
                                            @warn "Reading WebSocket client stream failed for unknown reason:" parentbody exception = (ex, bt)
                                        end
                                    end
                                end
                            end
                        catch ex
                            if ex isa InterruptException || ex isa HTTP.WebSockets.WebSocketError || ex isa EOFError || (ex isa Base.IOError && occursin("connection reset", ex.msg))
                                # that's fine!
                            else
                                bt = stacktrace(catch_backtrace())
                                @warn "Reading WebSocket client stream failed for unknown reason:" exception = (ex, bt)
                            end
                        finally
                            if haskey(session.connected_clients, found_client_id_ref[])
                                @debug "Removing client $(found_client_id_ref[]) from connected_clients"
                                delete!(session.connected_clients, found_client_id_ref[])
                            end
                        end
                    end
                catch ex
                    if ex isa InterruptException
                        # that's fine!
                    elseif ex isa Base.IOError
                        # that's fine!
                    elseif ex isa ArgumentError && occursin("stream is closed", ex.msg)
                        # that's fine!
                    else
                        bt = stacktrace(catch_backtrace())
                        @warn "HTTP upgrade failed for unknown reason" exception = (ex, bt)
                    end
                finally
                    # if we never wrote a response, then do it now
                    if isopen(http)
                        finish()
                    end
                end
            else
                finish()
            end
        else
            # then it's a regular HTTP request, not a WS upgrade

            # `http.message` only carries the request metadata; rebuild a request that includes the body for the handlers.
            request::HTTP.Request = let m = http.message
                HTTP.Request(
                    m.method,
                    m.target;
                    headers=m.headers,
                    body=read(http),
                    host=m.host,
                    proto_major=Int(m.proto_major),
                    proto_minor=Int(m.proto_minor),
                    close=m.close,
                )
            end

            # If a "token" url parameter is passed in from binder, then we store it to add to every URL (so that you can share the URL to collaborate).
            let
                params = HTTP.queryparams(HTTP.URI(request.target))
                if haskey(params, "token") && params["token"] ∉ ("null", "undefined", "") && session.binder_token === nothing
                    session.binder_token = params["token"]
                end
            end

            ###
            response::HTTP.Response = app(request)
            ###

            response.request = request
            try
                # The stream writes the status, headers and Content-Length from its `response` when `startwrite` is called.
                http.response = response
                # https://github.com/fonsp/Pluto.jl/pull/722
                HTTP.setheader(http, "Referrer-Policy" => "same-origin")
                # https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#:~:text=is%202%20minutes.-,14.38%20Server
                HTTP.setheader(http, "Server" => "Pluto.jl/$(PLUTO_VERSION_STR[2:end]) Julia/$(JULIA_VERSION_STR[2:end])")
                HTTP.startwrite(http)
                write(http, response_body_bytes(response.body))
                # Finish the response here (rather than letting the server loop do
                # it) so that a client that disconnects mid-response is handled by
                # the catch below instead of aborting the connection in the loop.
                HTTP.closewrite(http)
            catch e
                # The client hung up before we finished writing; nothing to do.
                # Reseau surfaces a disconnect as SystemError (e.g. broken pipe).
                if !(e isa Base.IOError || e isa ArgumentError || e isa Base.SystemError)
                    rethrow(e)
                end
            end
        end
    end

    server_running() =
        try
            HTTP.get("http://$(hostIP):$(port)$(session.options.server.base_url)ping"; status_exception=false, retry=false, connect_timeout=10, read_idle_timeout=10).status == 200
        catch
            false
        end
    # Wait for the server to start up before opening the browser. We have a 5 second grace period for allowing the connection, and then 10 seconds for the server to write data.
    WorkspaceManager.poll(server_running, 5.0, 1.0)

    address = pretty_address(session, hostIP, port)
    if session.options.server.launch_browser && open_in_default_browser(address)
        @info("\nOpening $address in your default browser... ~ have fun!\n\n")
    else
        @info("\nGo to $address in your browser to start writing ~ have fun!\n\n")
    end
    @info("\nPress Ctrl+C in this terminal to stop Pluto\n\n")

    # Trigger ServerStartEvent with server details
    try_event_call(session, ServerStartEvent(address, port))

    if frontend_directory() == "frontend"
        @info("It looks like you are developing the Pluto package, using the unbundled frontend...")
    end

    # Start this in the background, so that the first notebook launch (which will trigger registry update) will be faster
    initial_registry_update_task = @asynclog withtoken(pkg_token) do
        will_update = !PkgCompat.check_registry_age()
        PkgCompat.update_registries(; force = false)
        will_update && println("    Updating registry done ✓")
    end

    return RunningPlutoServer(server, on_shutdown, initial_registry_update_task)
end
precompile(run, (ServerSession, HTTP.Handlers.Router{Symbol("##001")}))

function pretty_address(session::ServerSession, hostIP, port)
    root = if session.options.server.root_url !== nothing
        @assert endswith(session.options.server.root_url, "/")
        replace(session.options.server.root_url, "{PORT}" => string(Int(port)))
    elseif haskey(ENV, "JULIAHUB_APP_URL")
        "$(ENV["JULIAHUB_APP_URL"])proxy/$(Int(port))/"
    elseif haskey(ENV, "JH_APP_URL")
        # legacy name for JULIAHUB_APP_URL, still set on older JuliaHub jobs
        "$(ENV["JH_APP_URL"])proxy/$(Int(port))/"
    else
        host_str = string(hostIP)
        host_pretty = if isa(hostIP, Sockets.IPv6)
            if host_str == "::1"
                "localhost"
            else
                "[$(host_str)]"
            end
        elseif host_str == "127.0.0.1" # Assuming the other alternative is IPv4
            "localhost"
        else
            host_str
        end
        port_pretty = Int(port)
        base_url = session.options.server.base_url
        "http://$(host_pretty):$(port_pretty)$(base_url)"
    end

    url_params = Dict{String,String}()

    if session.options.security.require_secret_for_access
        url_params["secret"] = session.secret
    end
    fav_notebook = let n = session.options.server.notebook
        n isa AbstractVector ? (isempty(n) ? nothing : first(n)) : n
    end
    new_root = if fav_notebook !== nothing
        # since this notebook already started running, this will get redicted to that session
        url_params["path"] = string(fav_notebook)
        root * "open"
    else
        root
    end
    string(HTTP.URI(HTTP.URI(new_root); query = url_params))
end

"""
All messages sent over the WebSocket from the client get decoded+deserialized and end up here.

It calls one of the functions from the `responses` Dict, see the file Dynamic.jl.
"""
function process_ws_message(session::ServerSession, parentbody::Dict, clientstream)
    client_id = Symbol(parentbody["client_id"])
    client = get!(session.connected_clients, client_id) do 
        ClientSession(client_id, clientstream, session.options.server.simulated_lag)
    end
    client.stream = clientstream # it might change when the same client reconnects

    messagetype = Symbol(parentbody["type"])
    request_id = Symbol(parentbody["request_id"])

    notebook = if haskey(parentbody, "notebook_id") && parentbody["notebook_id"] !== nothing
        notebook = let
            notebook_id = UUID(parentbody["notebook_id"])
            get(session.notebooks, notebook_id, nothing)
        end

        if messagetype === :connect
            if notebook === nothing
                messagetype === :connect || @warn "Remote notebook not found locally!"
            else
                client.connected_notebook = notebook
            end
        end

        notebook
    else
        nothing
    end

    body = parentbody["body"]

    if haskey(responses, messagetype)
        responsefunc = responses[messagetype]
        try
            responsefunc(ClientRequest(session, notebook, body, Initiator(client, request_id)))
        catch ex
            @warn "Response function to message of type $(repr(messagetype)) failed"
            rethrow(ex)
        end
    else
        @warn "Message of type $(messagetype) not recognised"
    end
end
