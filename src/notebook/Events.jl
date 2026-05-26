import HTTP

"""Pluto Events interface

Use this interface to hook up functionality into the Pluto world.
Events are guaranteed to be run at least every time something interesting happens,
but keep in mind that Pluto may be run the events multiple times "logically". For instance,
the FileSaveEvent may be triggered whenever pluto wants to make sure the file is saved, 
which may be more often than the file is actually changed. Deduplicate on your own if
you care about this.

Define your function to handle the events using multiple dispatch:

First assign a handler for all the types you will not use, using the supertype:

```julia-repl
julia> function myfn(a::PlutoEvent)
            nothing
        end
```


And then create a special function for each event you want to handle specially

```julia-repl
julia> function myfn(a::FileSaveEvent)
            HTTP.post("https://my.service.com/count_saves")
        end
```

Finally, pass the listener to Pluto's configurations with a keyword argument

```julia-repl
julia> Pluto.run(; on_event = myfn)
```
"""
abstract type PlutoEvent end

function try_event_call(session, event::PlutoEvent)
    return try
        session.options.server.on_event(event)
    catch e
        # Do not print all the event; it's too big!
        @warn "Couldn't run event listener" event_type=typeof(event) exception=(e, catch_backtrace())
        nothing
    end
end


# Triggered when the web server gets started
struct ServerStartEvent <: PlutoEvent
    address::String
    port::UInt16
end

# Triggered when a notebook is saved
struct FileSaveEvent <: PlutoEvent
    notebook::Notebook
    file_contents::String
    path::String
end

FileSaveEvent(notebook::Notebook) = begin
    file_contents = sprint() do io
        save_notebook(io, notebook)
    end
    FileSaveEvent(notebook, file_contents, notebook.path)
end

"""
Triggered when the notebook state changes (e.g. code changes, output changes, a log message appears, etc)
"""
struct StateChangeEvent <: PlutoEvent
    notebook::Notebook
end


# Triggered when we create a new notebook
struct NewNotebookEvent <: PlutoEvent
end

# Triggered when we open any notebook
struct OpenNotebookEvent <: PlutoEvent
    notebook::Notebook
end

# Triggered when Pluto completes an evaluation loop
struct NotebookExecutionDoneEvent <: PlutoEvent
    notebook::Notebook
    user_requested_run::Bool
end

# This will be fired ONLY if URL params don't match anything else.
# Useful if you want to create a file in a custom way,
# before opening the notebook
# Should return a redirect to /edit?id={notebook_id}
# Note: use Pluto.open - try_launch_notebook_response will return a fitting response.
struct CustomLaunchEvent <: PlutoEvent
    params::Dict{Any, Any}
    request::HTTP.Request
    try_launch_notebook_response::Function
end

# Triggered when a notebook has shut down.
struct ShutdownNotebookEvent <: PlutoEvent
    notebook::Notebook
end
