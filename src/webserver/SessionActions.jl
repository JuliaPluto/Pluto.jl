module SessionActions

import ..Pluto: Pluto, Status, ServerSession, Notebook, Cell, emptynotebook, tamepath, new_notebooks_directory, without_pluto_file_extension, numbered_until_new, cutename, readwrite, update_save_run!, update_nbpkg_cache!, update_from_file, wait_until_file_unchanged, putnotebookupdates!, putplutoupdates!, load_notebook, clientupdate_notebook_list, WorkspaceManager, try_event_call, NewNotebookEvent, OpenNotebookEvent, ShutdownNotebookEvent, @asynclog, ProcessStatus, maybe_convert_path_to_wsl, move_notebook!, Throttled
using FileWatching
import ..Pluto.DownloadCool: download_cool
import HTTP

import UUIDs: UUID, uuid1

struct NotebookIsRunningException <: Exception
    notebook::Notebook
end

abstract type AbstractUserError <: Exception end
struct UserError <: AbstractUserError
    msg::String
end
function Base.showerror(io::IO, e::UserError)
    print(io, e.msg)
end

_isboring_original_name(name::AbstractString) = isempty(name) || name in ("notebook", "notebookfile")

function open_url(session::ServerSession, url::AbstractString; kwargs...)
    name_from_url = startswith(url, r"https?://") ? strip(HTTP.unescapeuri(splitext(basename(HTTP.URI(url).path))[1])) : ""
    new_name = _isboring_original_name(name_from_url) ? cutename() : name_from_url
    
    random_notebook = emptynotebook()
    random_notebook.path = numbered_until_new(
        joinpath(
            new_notebooks_directory(), 
            new_name
        ); suffix=".jl")
    
    path = download_cool(url, random_notebook.path)
    result = try_event_call(session, NewNotebookEvent())
    notebook = if result isa UUID
        open(session, path; notebook_id=result, kwargs...)
    else
        open(session, path; kwargs...)
    end
    return notebook
end


const notebook_loading_lock = ReentrantLock()

"Open the notebook at `path` into `session::ServerSession` and run it. Returns the `Notebook`."
function open(session::ServerSession, path::AbstractString; 
    execution_allowed::Bool=true,
    run_async::Bool=true, 
    compiler_options=nothing, 
    as_sample::Bool=false, 
    risky_file_source::Union{Nothing,String}=nothing,
    clear_frontmatter::Bool=false,
    notebook_id::UUID=uuid1()
)
    path = maybe_convert_path_to_wsl(path)
    if as_sample
        new_filename = "sample " * without_pluto_file_extension(basename(path))
        new_path = numbered_until_new(joinpath(new_notebooks_directory(), new_filename); suffix=".jl")
        
        readwrite(path, new_path)
        path = new_path
    end
    
    notebook = lock(notebook_loading_lock) do
        # is this path already open?
        for notebook in values(session.notebooks)
            if isfile(notebook.path) && realpath(notebook.path) == realpath(tamepath(path))
                throw(NotebookIsRunningException(notebook))
            end
        end

        # load the notebook
        notebook = load_notebook(tamepath(path); disable_writing_notebook_files=session.options.server.disable_writing_notebook_files)
        notebook.notebook_id = notebook_id
        
        session.notebooks[notebook.notebook_id] = notebook
        return notebook
    end
    
    # handle "Safe Preview" mode
    execution_allowed = execution_allowed && !haskey(notebook.metadata, "risky_file_source")
    if !isnothing(risky_file_source)
        notebook.metadata["risky_file_source"] = risky_file_source
    end
    notebook.process_status = execution_allowed ? ProcessStatus.starting : ProcessStatus.waiting_for_permission

    # overwrites the notebook environment if specified
    if compiler_options !== nothing
        notebook.compiler_options = compiler_options
    end
    if clear_frontmatter
        Pluto.set_frontmatter!(notebook, nothing)
    end

    
    if execution_allowed && session.options.evaluation.run_notebook_on_load
        Pluto._report_business_cells_planned!(notebook)
    end
    
    if !execution_allowed
        Status.delete_business!(notebook.status_tree, :run)
        Status.delete_business!(notebook.status_tree, :workspace)
        Status.delete_business!(notebook.status_tree, :pkg)
    end

    update_nbpkg_cache!(notebook)

    update_save_run!(session, notebook, notebook.cells; run_async, prerender_text=true)
    add(session, notebook; run_async)
    try_event_call(session, OpenNotebookEvent(notebook))
    return notebook
end

function add(session::ServerSession, notebook::Notebook; run_async::Bool=true)
    session.notebooks[notebook.notebook_id] = notebook
    
    if run_async
        @asynclog putplutoupdates!(session, clientupdate_notebook_list(session.notebooks))
    else
        putplutoupdates!(session, clientupdate_notebook_list(session.notebooks))
    end
    
    
    update_from_file_throttled = let
        running = Ref(false)
        function()
            if !running[]
                running[] = true
                
                @info "Updating from file..."
                
                sleep(0.1) ## There seems to be a synchronization issue if your OS is VERYFAST
                wait_until_file_unchanged(notebook.path, .3)
                
                # call update_from_file. If it returns false, that means that the notebook file was corrupt, so we try again, a maximum of 10 times.
                for _ in 1:10
                    if update_from_file(session, notebook)
                        break
                    end
                end
                
                
                @info "Updating from file done!"
                
                running[] = false
            end
        end
    end

    in_session() = get(session.notebooks, notebook.notebook_id, nothing) === notebook
    
    session.options.server.auto_reload_from_file && @asynclog try
        while in_session()
            if !isfile(notebook.path)
                # notebook file deleted... let's ignore this, changing the notebook will cause it to save again. Fine for now
                sleep(2)
            else
                e = watch_file(notebook.path, 3)
                if e.timedout
                    continue
                end
                
                # the above call is blocking until the file changes
                
                local modified_time = mtime(notebook.path)
                local _tries = 0
                
                # mtime might return zero if the file is temporarily removed
                while modified_time == 0.0 && _tries < 10
                    modified_time = mtime(notebook.path)
                    _tries += 1
                    sleep(.05)
                end
                
                # current_time = time()
                # @info "File changed" (current_time - notebook.last_save_time) (modified_time - notebook.last_save_time) (current_time - modified_time)
                if !in_session()
                    break
                end
                
                # if current_time - notebook.last_save_time < 2.0
                    # @info "Notebook was saved by me very recently, not reloading from file."
                if modified_time == 0.0
                    # @warn "Failed to hot reload: file no longer exists."
                elseif modified_time - notebook.last_save_time < session.options.server.auto_reload_from_file_cooldown
                    # @info "Modified time is very close to my last save time, not reloading from file."
                else
                    update_from_file_throttled()
                end
            end
        end
    catch e
        if !(e isa InterruptException)
            rethrow(e)
        end
    end
    
    notebook.status_tree.update_listener_ref[] = Throttled.throttled(1.0 / 8; runtime_multiplier=4.0) do
        Pluto.send_notebook_changes!(Pluto.ClientRequest(; session, notebook))
    end

    return notebook
end

"""
Generate a non-existing new notebook filename, and write `contents` to that file. Return the generated filename.

# Example
```julia
save_upload(some_notebook_data; filename_base="hello") == "~/.julia/pluto_notebooks/hello 5.jl"
```
"""
function save_upload(contents::Union{String,Vector{UInt8}}; filename_base::Union{Nothing,AbstractString}=nothing)
    save_path = numbered_until_new(
        joinpath(
            new_notebooks_directory(), 
            something(filename_base, cutename())
        ); suffix=".jl")
    write(save_path, contents)
    save_path
end

"Create a new empty notebook inside `session::ServerSession`. Returns the `Notebook`."
function new(session::ServerSession; run_async=true, notebook_id::UUID=uuid1())
    notebook = if session.options.compiler.sysimage === nothing
        emptynotebook()
    else
        Notebook([Cell("import Pkg"), Cell("# This cell disables Pluto's package manager and activates the global environment. Click on ? inside the bubble next to Pkg.activate to learn more.\n# (added automatically because a sysimage is used)\nPkg.activate()"), Cell()])
    end

    # Run NewNotebookEvent handler before assigning ID
    isid = try_event_call(session, NewNotebookEvent())
    notebook.notebook_id = isnothing(isid) ? notebook_id : isid

    update_save_run!(session, notebook, notebook.cells; run_async, prerender_text=true)
    add(session, notebook; run_async)
    try_event_call(session, OpenNotebookEvent(notebook))
    return notebook
end

"Shut down `notebook` inside `session`. If `keep_in_session` is `false` (default), you will not be allowed to run a notebook with the same notebook_id again."
function shutdown(session::ServerSession, notebook::Notebook; keep_in_session::Bool=false, async::Bool=false, verbose::Bool=true)
    notebook.nbpkg_restart_recommended_msg = nothing
    notebook.nbpkg_restart_required_msg = nothing
    
    if notebook.process_status ∈ (ProcessStatus.ready, ProcessStatus.starting)
        notebook.process_status = ProcessStatus.no_process
    end

    if !keep_in_session
        listeners = putnotebookupdates!(session, notebook) # TODO: shutdown message
        delete!(session.notebooks, notebook.notebook_id)
        putplutoupdates!(session, clientupdate_notebook_list(session.notebooks))
        for client in listeners
            @async close(client.stream)
        end
    end
    WorkspaceManager.unmake_workspace((session, notebook); async, verbose, allow_restart=keep_in_session)
    try_event_call(session, ShutdownNotebookEvent(notebook))
end

function move(session::ServerSession, notebook::Notebook, newpath::String)
    newpath = tamepath(newpath)

    if isfile(newpath)
        error("File exists already - you need to delete the old file manually.")
    else
        move_notebook!(notebook, newpath; disable_writing_notebook_files=session.options.server.disable_writing_notebook_files)
        putplutoupdates!(session, clientupdate_notebook_list(session.notebooks))
        let workspace = WorkspaceManager.get_workspace((session, notebook); allow_creation=false)
            isnothing(workspace) || WorkspaceManager.cd_workspace(workspace, newpath)
        end
    end 
end

end
