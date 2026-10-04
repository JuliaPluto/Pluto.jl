import HTTP
import Sockets

#=
Pluto runs on both HTTP.jl 1.x and HTTP.jl 2.x.

Nearly all of the HTTP.jl API that Pluto uses is spelled the same way in both
series: `HTTP.Router`, `HTTP.register!`, `HTTP.Request`, `HTTP.Response`,
`HTTP.setheader`, `HTTP.streamhandler`, `HTTP.WebSockets.upgrade` and friends
all behave identically for our purposes.

The differences that Pluto does run into are collected in this file, so that the
rest of the web server can be written once:

- the server socket type that `HTTP.listen!` accepts,
- the `Origin` check that 2.x performs on WebSocket upgrades,
- the type of an in-memory request body,
- who is responsible for the `Content-Length` response header,
- the exception thrown when a client disconnects halfway through a response.
=#

"""
Is the loaded HTTP.jl from the 2.x series? Used by the version-adaptive
definitions in `src/webserver/HTTPCompat.jl`.

This is a compile-time constant: changing the HTTP.jl version invalidates
Pluto's precompilation cache, so the right branches get baked in.
"""
const HTTP_IS_V2 = pkgversion(HTTP) ≥ v"2"


@static if HTTP_IS_V2
    # HTTP.jl 2 delegates its transport to Reseau and wants a Reseau listener
    # (`HTTP.TCP` is `Reseau.TCP`), not a `Sockets.TCPServer`.
    "Listen for TCP connections on `host:port`, returning a socket that `http_listen!` accepts."
    listen_socket(host::Sockets.IPAddr, port::Integer) =
        HTTP.TCP.listen("tcp", HTTP.HostResolvers.join_host_port(string(host), Int(port)))

    "Serve `handler` — an `HTTP.Stream -> Any` function — on `socket`."
    http_listen!(handler, socket) = HTTP.listen!(handler, socket)
else
    "Listen for TCP connections on `host:port`, returning a socket that `http_listen!` accepts."
    listen_socket(host::Sockets.IPAddr, port::Integer) = Sockets.listen(host, UInt16(port))

    "Serve `handler` — an `HTTP.Stream -> Any` function — on `socket`."
    # `verbose=-1` silences HTTP.jl 1's per-connection logging. 2.x has no such logging.
    http_listen!(handler, socket) = HTTP.listen!(handler, socket; verbose=-1)
end


"""
Extra keyword arguments for `HTTP.WebSockets.upgrade`.

HTTP.jl 2 rejects an upgrade whose `Origin` header does not match the request's
own scheme, host and port. Pluto is routinely served through reverse proxies
(Binder, JupyterHub, JuliaHub) that terminate TLS and rewrite `Host`, which
makes that comparison fail for legitimate clients, so we opt out — matching
HTTP.jl 1, which does not check the origin at all.

Pluto does not rely on the `Origin` header for security: an upgrade is
authenticated by the session secret, and the cookie carrying that secret is
`SameSite=Strict`, so it is not sent along with a cross-site handshake.
"""
const WEBSOCKET_UPGRADE_KWARGS = @static if HTTP_IS_V2
    (; check_origin = (request, origin) -> true)
else
    (;)
end


"""
Client keyword arguments that give up on a request that stalls. HTTP.jl 2
renamed `readtimeout` to `read_idle_timeout` and warns when the old name is used.
"""
const CLIENT_TIMEOUT_KWARGS = @static if HTTP_IS_V2
    (; connect_timeout=10, read_idle_timeout=10)
else
    (; connect_timeout=10, readtimeout=10)
end


"The bytes of a fully-read, in-memory request body."
request_body_bytes(request::HTTP.Request) = _body_bytes(request.body)
_body_bytes(body::AbstractVector{UInt8}) = body
@static if HTTP_IS_V2
    # HTTP.jl 2 wraps a request body in an `AbstractBody` instead of handing out
    # the raw bytes.
    _body_bytes(body::HTTP.BytesBody) = copy(body)
    _body_bytes(::HTTP.EmptyBody) = UInt8[]
end


@static if HTTP_IS_V2
    "Announce the size of an in-memory response body."
    # HTTP.jl 2 writes `Content-Length` itself, from the body it was given.
    set_content_length!(::HTTP.Response) = nothing
else
    "Announce the size of an in-memory response body."
    # Without this, HTTP.jl 1 falls back to chunked transfer encoding.
    set_content_length!(response::HTTP.Response) =
        HTTP.setheader(response, "Content-Length" => string(length(response.body)))
end


"""
Did this exception come from the client going away, rather than from a bug in
Pluto? Browsers hang up on responses all the time (navigating away, reloading,
cancelling a download), and that is not worth a warning.
"""
is_disconnection_exception(e) =
    e isa Base.IOError ||          # HTTP.jl 1
    e isa Base.SystemError ||      # HTTP.jl 2: Reseau reports a broken pipe like this
    e isa EOFError ||
    # writing to an `HTTP.Stream` whose response is already finished
    (e isa ArgumentError && occursin("closed", e.msg))
