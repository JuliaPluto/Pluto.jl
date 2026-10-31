
function serialize_message_to_stream(io::IO, message::UpdateMessage)
    to_send = Dict(:type => message.type, :message => message.message)
    if message.notebook !== nothing
        to_send[:notebook_id] = message.notebook.notebook_id
    end
    if message.cell !== nothing
        to_send[:cell_id] = message.cell.cell_id
    end
    if message.initiator !== nothing
        to_send[:initiator_id] = message.initiator.client_id
        to_send[:request_id] = message.initiator.request_id
    end

    pack(io, to_send)
end

function serialize_message(message::UpdateMessage)
    io = IOBuffer()
    serialize_message_to_stream(io, message)
    take!(io)
end

"Send `messages` to all clients connected to the `notebook`."
function putnotebookupdates!(session::ServerSession, notebook::Notebook, messages::UpdateMessage...; flush::Bool=true)
    listeners = filter(collect(values(session.connected_clients))) do c
        c.connected_notebook !== nothing &&
        c.connected_notebook.notebook_id == notebook.notebook_id
    end
    for next_to_send in messages, client in listeners
        put!(client.pendingupdates, next_to_send)
    end
    flush && flushallclients(session, listeners)
    listeners
end

"Send `messages` to all connected clients."
function putplutoupdates!(session::ServerSession, messages::UpdateMessage...; flush::Bool=true)
    listeners = collect(values(session.connected_clients))
    for next_to_send in messages, client in listeners
        put!(client.pendingupdates, next_to_send)
    end
    flush && flushallclients(session, listeners)
    listeners
end

"Send `messages` to a `client`."
function putclientupdates!(client::ClientSession, messages::UpdateMessage...)
    for next_to_send in messages
        put!(client.pendingupdates, next_to_send)
    end
    flushclient(client)
    client
end

"Send `messages` to the `ClientSession` who initiated."
function putclientupdates!(session::ServerSession, initiator::Initiator, messages::UpdateMessage...)
    # Prevent long, scary looking, error.
    if !haskey(session.connected_clients, initiator.client_id)
        @warn "Trying to send clientupdate to disconnected client." messages=map(x -> x.type, messages)
        return
    end

    putclientupdates!(session.connected_clients[initiator.client_id], messages...)
end

# https://github.com/JuliaWeb/HTTP.jl/issues/382
const flushtoken = Token()

function send_message(stream::HTTP.WebSockets.WebSocket, msg)
    HTTP.WebSockets.send(stream, serialize_message(msg))
end
function send_message(stream::IO, msg)
    write(stream, serialize_message(msg))
end

function is_stream_open(stream::HTTP.WebSockets.WebSocket)
    !HTTP.WebSockets.isclosed(stream)
end
function is_stream_open(io::IO)
    isopen(io)
end

function flushclient(client::ClientSession)
    take!(flushtoken)
    while isready(client.pendingupdates)
        next_to_send = take!(client.pendingupdates)

        try
            if client.stream !== nothing
                if is_stream_open(client.stream)
                    let
                        lag = client.simulated_lag
                        (lag > 0) && sleep(lag * (0.5 + rand())) # sleep(0) would yield to the process manager which we dont want
                    end

                    send_message(client.stream, next_to_send)
                else
                    put!(flushtoken)
                    return false
                end
            end
        catch ex
            bt = stacktrace(catch_backtrace())
            if ex isa Base.IOError || (ex isa ArgumentError && occursin("closed", ex.msg))
                # client socket closed, so we return false (about 5 lines after this one)
            else
                @warn "Failed to write to WebSocket of $(client.id) " exception = (ex, bt)
            end
            put!(flushtoken)
            return false
        end
    end
    put!(flushtoken)
    true
end

function flushallclients(session::ServerSession, subset::Union{Set{ClientSession},AbstractVector{ClientSession}})
    disconnected = Set{Symbol}()
    for client in subset
        stillconnected = flushclient(client)
        if !stillconnected
            push!(disconnected, client.id)
        end
    end
    for to_delete_id in disconnected
        delete!(session.connected_clients, to_delete_id)
    end
end

function flushallclients(session::ServerSession)
    flushallclients(session, values(session.connected_clients))
end
