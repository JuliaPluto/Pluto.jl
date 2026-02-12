import UUIDs: UUID, uuid1
import .Configuration

###
# CLIENT
###

mutable struct ClientSession
    id::Symbol
    stream::Any
    connected_notebook::Union{Notebook,Nothing}
    pendingupdates::Channel
    simulated_lag::Float64
end

ClientSession(id::Symbol, stream, simulated_lag=0.0) = let
    ClientSession(id, stream, nothing, Channel(1024), simulated_lag)
end

"A combination of _client ID_ and a _request ID_. The front-end generates a unqique ID for every request that it sends. The back-end (the stuff you are currently reading) can respond to a specific request. In that case, the response does not go through the normal message handlers in the front-end, but it flies directly to the place where the message was sent. (It resolves the promise returned by `send(...)`.)"
struct Initiator
    client::ClientSession
    request_id::Symbol
end
function Base.getproperty(initiator::Initiator, property::Symbol)
    if property == :client_id
        getfield(initiator, :client).id
    else
        getfield(initiator, property)
    end
end

###
# SERVER
###


const SESSION_UPDATE_LOOP_INTERVAL = Ref(2.0 * 60 * 60) # 2 hours, this should be less than half of `max_age` of the `cleanup` function in `temp dir in scratch.jl`
const SESSION_UPDATE_LOOP_DELAY = Ref(15.0 * 60) # 15 minutes


"""
The `ServerSession` keeps track of:

- `connected_clients`: connected (web) clients
- `notebooks`: running notebooks
- `secret`: the web access token
- `options`: global pluto configuration `Options` for this session.

Use the keyword constructor.
"""
Base.@kwdef mutable struct ServerSession
    connected_clients::Dict{Symbol,ClientSession} = Dict{Symbol,ClientSession}()
    notebooks::Dict{UUID,Notebook} = Dict{UUID,Notebook}()
    secret::String = String(rand(('a':'z') ∪ ('A':'Z') ∪ ('0':'9'), 8))
    binder_token::Union{String,Nothing} = nothing
    options::Configuration.Options = Configuration.Options()
    
    function ServerSession(
        connected_clients,
        notebooks,
        secret,
        binder_token,
        options,
    )
        x = new(
            connected_clients,
            notebooks,
            secret,
            binder_token,
            options,    
        )
        timer = Timer(SESSION_UPDATE_LOOP_DELAY[]; interval=SESSION_UPDATE_LOOP_INTERVAL[]) do _t
            timer_callback(x)
        end
        finalizer(x) do _
            close(timer)
        end
    end
end


function save_notebook(session::ServerSession, notebook::Notebook)
    
    # Notify event_listener from here
    try_event_call(session, FileSaveEvent(notebook))
    if !session.options.server.disable_writing_notebook_files
        save_notebook(notebook, notebook.path)
    end
end

###
# UPDATE MESSAGE
###

struct UpdateMessage
    type::Symbol
    message::Any
    notebook::Union{Notebook,Nothing}
    cell::Union{Cell,Nothing}
    initiator::Union{Initiator,Nothing}
end

UpdateMessage(type::Symbol, message::Any) = UpdateMessage(type, message, nothing, nothing, nothing)
UpdateMessage(type::Symbol, message::Any, notebook::Notebook) = UpdateMessage(type, message, notebook, nothing, nothing)

function clientupdate_notebook_list(notebooks; initiator::Union{Initiator,Nothing}=nothing)
    UpdateMessage(:notebook_list,
        Dict(
            :notebooks => [
                Dict(
                    :notebook_id => notebook.notebook_id,
                    :path => notebook.path,
                    :in_temp_dir => startswith(notebook.path, new_notebooks_directory()),
                    :shortpath => basename(notebook.path),
                    :process_status => notebook.process_status,
                ) for notebook in values(notebooks)
            ]
        ), nothing, nothing, initiator)
end                