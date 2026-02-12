module WorkspaceManager
import UUIDs: UUID, uuid1
import ..Pluto
import ..Pluto: Configuration, Notebook, Cell, ProcessStatus, ServerSession, ExpressionExplorer, pluto_filename, Token, withtoken, tamepath, project_relative_path, putnotebookupdates!, UpdateMessage
import ..Pluto.Status
import ..Pluto.PkgCompat
import ..Configuration: CompilerOptions, _merge_notebook_compiler_options, _convert_to_flags
import ..Pluto.ExpressionExplorer: FunctionName
import ..PlutoRunner
import Malt
import Malt.Distributed
import SHA

"""
Contains the Julia process to evaluate code in.
Each notebook gets at most one `Workspace` at any time, but it can also have no `Workspace`
(it cannot `eval` code in this case).
"""
Base.@kwdef mutable struct Workspace
    worker::Malt.AbstractWorker
    notebook_id::UUID
    discarded::Bool=false
    remote_log_channel::Union{Distributed.RemoteChannel,AbstractChannel}
    module_name::Symbol
    dowork_token::Token=Token()
    nbpkg_was_active::Bool=false
    has_executed_effectful_code::Bool=false
    is_offline_renderer::Bool=false
    original_LOAD_PATH::Vector{String}=String[]
    original_ACTIVE_PROJECT::Union{Nothing,String}=nothing
end

const SN = Tuple{ServerSession, Notebook}

"These expressions get evaluated whenever a new `Workspace` process is created."
function process_preamble()
    loader_path = project_relative_path(joinpath("src", "runner"), "Loader.jl")
    project_toml_contents = try
        read(project_relative_path(joinpath("src", "runner"), "PlutoRunner", "Project.toml"), String)
    catch
        ""
    end
    lp_hash = string(reinterpret(UInt64, SHA.sha1(loader_path * project_toml_contents)[1:8])[1]; base=62)
    environment_path = joinpath(Pluto.pluto_boot_environment_path[], lp_hash)
    # Now the environment path includes (a hash of):
    # - Julia version
    # - Pluto version
    # - Loader.jl path
    # - PlutoRunner/Project.toml contents
    # And these 4 should uniquely define the contents of the Manifest.toml that gets generated. So we can safely use this as cache key.
    
    quote
        Base.exit_on_sigint(false)
        const pluto_boot_environment_path = $environment_path
        include($loader_path)
        ENV["GKSwstype"] = "nul"
        ENV["JULIA_REVISE_WORKER_ONLY"] = "1"
    end
end

const active_workspaces = Dict{UUID,Task}()

"Set of notebook IDs that we will never make a process for again."
const discarded_workspaces = Set{UUID}()

"Create a workspace for the notebook, optionally in the main process."
function make_workspace((session, notebook)::SN; is_offline_renderer::Bool=false)::Workspace
    workspace_business = is_offline_renderer ? Status.Business(name=:gobble) : Status.report_business_started!(notebook.status_tree, :workspace)
    create_status = Status.report_business_started!(workspace_business, :create_process)
    Status.report_business_planned!(workspace_business, :init_process)
    
    is_offline_renderer || (notebook.process_status = ProcessStatus.starting)
    
    WorkerType = if is_offline_renderer || !session.options.evaluation.workspace_use_distributed
        Malt.InProcessWorker
    elseif something(
        session.options.evaluation.workspace_use_distributed_stdlib, 
        false
    )
        Malt.DistributedStdlibWorker
    else
        Malt.Worker
    end
    
    @debug "Creating workspace process" notebook.path is_offline_renderer length(notebook.cells) exception=(ErrorException("test"), backtrace())
    try
        worker = create_workspaceprocess(WorkerType; compiler_options=_merge_notebook_compiler_options(notebook, session.options.compiler), status=create_status)
        
        Status.report_business_finished!(workspace_business, :create_process)
        init_status = Status.report_business_started!(workspace_business, :init_process)
        Status.report_business_started!(init_status, Symbol(1))
        Status.report_business_planned!(init_status, Symbol(2))
        Status.report_business_planned!(init_status, Symbol(3))
        Status.report_business_planned!(init_status, Symbol(4))

        let s = session.options.evaluation.workspace_custom_startup_expr
            s === nothing || Malt.remote_eval_wait(worker, Meta.parseall(s))
        end

        Malt.remote_eval_wait(worker, quote
            PlutoRunner.notebook_id[] = $(notebook.notebook_id)
        end)

        remote_log_channel = Malt.worker_channel(worker, quote
            channel = Channel{Any}(10)
            Main.PlutoRunner.setup_plutologger(
                $(notebook.notebook_id),
                channel
            )
            channel
        end)

        run_channel = Malt.worker_channel(worker, :(Main.PlutoRunner.run_channel))

        module_name = create_emptyworkspacemodule(worker)

        original_LOAD_PATH, original_ACTIVE_PROJECT = Malt.remote_eval_fetch(worker, :(Base.LOAD_PATH, Base.ACTIVE_PROJECT[]))

        workspace = Workspace(;
            worker,
            notebook_id=notebook.notebook_id,
            remote_log_channel,
            module_name,
            original_LOAD_PATH,
            original_ACTIVE_PROJECT,
            is_offline_renderer,
        )
        
        
        Status.report_business_finished!(init_status, Symbol(1))
        Status.report_business_started!(init_status, Symbol(2))

        @async start_relaying_logs((session, notebook), remote_log_channel)
        @async start_relaying_self_updates((session, notebook), run_channel)
        is_offline_renderer || cd_workspace(workspace, notebook.path)
        
        Status.report_business_finished!(init_status, Symbol(2))
        Status.report_business_started!(init_status, Symbol(3))
        
        use_nbpkg_environment((session, notebook), workspace)
        
        Status.report_business_finished!(init_status, Symbol(3))
        Status.report_business_started!(init_status, Symbol(4))
        
        # TODO: precompile 1+1 with display
        # sleep(3)
        eval_format_fetch_in_workspace(workspace, Expr(:toplevel, LineNumberNode(-1), :(1+1)), uuid1(); code_is_effectful=false)
        
        Status.report_business_finished!(init_status, Symbol(4))
        Status.report_business_finished!(workspace_business, :init_process)
        Status.report_business_finished!(workspace_business)

        is_offline_renderer || if notebook.process_status == ProcessStatus.starting
            notebook.process_status = ProcessStatus.ready
        end
        return workspace
    catch e
        Status.report_business_finished!(workspace_business, false)
        notebook.process_status = ProcessStatus.no_process
        rethrow(e)
    end
end

function use_nbpkg_environment((session, notebook)::SN, workspace=nothing)
    enabled = notebook.nbpkg_ctx !== nothing
    workspace.nbpkg_was_active == enabled && return

    workspace = workspace !== nothing ? workspace : get_workspace((session, notebook))
    workspace.discarded && return

    workspace.nbpkg_was_active = enabled
    if workspace.worker isa Malt.InProcessWorker
        # Not supported
        return
    end
    new_LP = enabled ? ["@", "@stdlib"] : workspace.original_LOAD_PATH
    new_AP = enabled ? PkgCompat.env_dir(notebook.nbpkg_ctx) : workspace.original_ACTIVE_PROJECT

    Malt.remote_eval_wait(workspace.worker, quote
        copy!(LOAD_PATH, $(new_LP))
        Base.ACTIVE_PROJECT[] = $(new_AP)
    end)
end



function precompile_nbpkg((session, notebook)::SN; io=stdout)::Bool
    workspace_task = try
        get_workspace((session, notebook); async=true)
    catch e
        e isa DiscardedWorkspaceException && return false
        rethrow(e)
    end
    not_ready_yet = workspace_task === nothing || !istaskdone(workspace_task)
    if not_ready_yet
        print(io, "Waiting for notebook process to start... ")
    end
    workspace = fetch(workspace_task)
    not_ready_yet && println(io, "Done. Starting precompilation...")
    Malt.isrunning(workspace.worker) || return false

    io_writes_channel = Malt.worker_channel(workspace.worker, :(__precomp_io_writes_channel = Channel(10)))
    
    expr = quote
        # This is just Pkg.precompile, but with extra stuff to relay stdout to the host process
        import Pkg
        let
            buffer = Base.BufferStream()
            running = Ref(true)
            @async try
                while running[] && !eof(buffer) && isreadable(buffer)
                    newdata = readavailable(buffer)
                    isopen(__precomp_io_writes_channel) || break
                    isempty(newdata) || put!(__precomp_io_writes_channel, newdata)
                    sleep(0.01)
                end
            catch e
                println(stderr, "Error while relaying precompilation stdout: ", sprint(showerror, e, catch_backtrace()))
            end
            
            out_stream = IOContext(
                buffer,
                :color => true,
                # Look at that, I put a feature in Julia! 😎
                # https://github.com/JuliaLang/julia/pull/58887
                :force_fancyprint => true,
            )
            
            try
                Pkg.precompile(; already_instantiated=true, io=out_stream)
            finally
                running[] = false
                println(buffer)
                flush(buffer)
                close(buffer)
                put!(__precomp_io_writes_channel, "")
                close(__precomp_io_writes_channel)
            end
        end
    end
    
    running = Ref(true)
    @async while running[]
        newdata = take!(io_writes_channel)
        write(io, newdata)
        sleep(0.01)
    end

    try
        withtoken(workspace.dowork_token) do
            Malt.remote_eval_wait(workspace.worker, expr)
        end
    catch e
        throw(PrecompilationFailedException(sprint(showerror, e)))
    finally
        running[] = false
    end
    
    true
end

struct PrecompilationFailedException <: Exception
    msg::String
end

function start_relaying_self_updates((session, notebook)::SN, run_channel)
    while true
        try
            next_run_uuid = take!(run_channel)

            cell_to_run = notebook.cells_dict[next_run_uuid]
            Pluto.run_reactive!(session, notebook, notebook.topology, notebook.topology, Cell[cell_to_run]; user_requested_run=false)
        catch e
            if !isopen(run_channel)
                break
            end
            @error "Failed to relay self-update" exception=(e, catch_backtrace())
        end
    end
end

function start_relaying_logs((session, notebook)::SN, log_channel)
    update_throttled = Pluto.Throttled.throttled(0.1) do
        Pluto.send_notebook_changes!(Pluto.ClientRequest(; session, notebook))
    end

    while true
        try
            next_log::Dict{String,Any} = take!(log_channel)

            fn = next_log["file"]
            match = findfirst("#==#", fn)

            # Show the log at the currently running cell, which is given by
            running_cell_id = next_log["cell_id"]::UUID

            # Some logs originate from outside of the running code, through function calls. Some code here to deal with that:
            begin
                source_cell_id = if match !== nothing
                    # The log originated from within the notebook
                    UUID(fn[match[end]+1:end])
                else
                    # The log originated from a function call defined outside of the notebook.
                    # Show the log at the currently running cell, at "line -1", i.e. without line info.
                    next_log["line"] = -1
                    running_cell_id
                end

                if running_cell_id != source_cell_id
                    # The log originated from a function in another cell of the notebook
                    # Show the log at the currently running cell, at "line -1", i.e. without line info.
                    next_log["line"] = -1
                end
            end

            source_cell = get(notebook.cells_dict, source_cell_id, nothing)
            running_cell = get(notebook.cells_dict, running_cell_id, nothing)

            display_cell = if running_cell === nothing || (source_cell !== nothing && source_cell.output.has_pluto_hook_features)
                source_cell
            else
                running_cell
            end

            @assert !isnothing(display_cell)

            # this handles the use of published_to_js inside logs: objects that were newly published during the rendering of the log args.
            merge!(display_cell.published_objects, next_log["new_published_objects"])
            delete!(next_log, "new_published_objects")

            push!(display_cell.logs, next_log)
            Pluto.@asynclog update_throttled()
        catch e
            if !isopen(log_channel)
                break
            end
            @error "Failed to relay log" exception=(e, catch_backtrace())
        end
    end
end

"Call `cd(\$path)` inside the workspace. This is done when creating a workspace, and whenever the notebook changes path."
function cd_workspace(workspace, path::AbstractString)
    eval_in_workspace(workspace, quote
        cd(dirname($path))
    end)
end

"Create a new empty workspace. Return the `(old, new)` workspace names as a tuple of `Symbol`s."
function bump_workspace_module(session_notebook::SN)
    workspace = get_workspace(session_notebook)
    old_name = workspace.module_name
    new_name = workspace.module_name = create_emptyworkspacemodule(workspace.worker)

    old_name, new_name
end

function get_bond_names(session_notebook::SN, cell_id)
    workspace = get_workspace(session_notebook)

    Malt.remote_eval_fetch(workspace.worker, quote
    PlutoRunner.get_bond_names($cell_id)
    end)
end

function possible_bond_values(session_notebook::SN, n::Symbol; get_length::Bool=false)
    workspace = get_workspace(session_notebook)

    Malt.remote_eval_fetch(workspace.worker, quote
        PlutoRunner.possible_bond_values($(QuoteNode(n)); get_length=$(get_length))
    end)
end

function create_emptyworkspacemodule(worker::Malt.AbstractWorker)::Symbol
    Malt.remote_eval_fetch(worker, quote
        PlutoRunner.increment_current_module()
    end)
end

# To avoid precompiling PlutoRunner multiple times in parallel https://github.com/fonsp/Pluto.jl/issues/3236
const workspace_setup_token = Token()

# NOTE: this function only start a worker process using given
# compiler options, it does not resolve paths for notebooks
# compiler configurations passed to it should be resolved before this
function create_workspaceprocess(WorkerType; compiler_options=CompilerOptions(), status::Status.Business=Status.Business())::Malt.AbstractWorker

    if WorkerType === Malt.InProcessWorker
        worker = WorkerType()
        
        if !(isdefined(Main, :PlutoRunner) && Main.PlutoRunner isa Module)
            # we make PlutoRunner available in Main, right now it's only defined inside this Pluto module.
            Malt.remote_eval_wait(Main, worker, quote
                PlutoRunner = $(PlutoRunner)
            end)
        end
    else
            
        Status.report_business_started!(status, Symbol("Starting process"))
        Status.report_business_planned!(status, Symbol("Loading notebook boot environment"))

        worker = WorkerType(; exeflags=_convert_to_flags(compiler_options))
        
        Status.report_business_finished!(status, Symbol("Starting process"))
        withtoken(workspace_setup_token) do
            Status.report_business_started!(status, Symbol("Loading notebook boot environment"))
            Malt.remote_eval_wait(worker, process_preamble())
        end
    
        # so that we NEVER break the workspace with an interrupt 🤕
        Malt.remote_eval(worker, quote
            while true
                try
                    wait()
                catch end
            end
        end)
    end
    
    Status.report_business_finished!(status)
    worker
end

const get_workspace_token = Token()

struct DiscardedWorkspaceException <: Exception
    notebook_id::UUID
end

Base.showerror(io::IO, e::DiscardedWorkspaceException) = print(io, "Cannot run code in this notebook: it has already shut down.")

"""
Return the `Workspace` of `notebook`; will be created if none exists yet.

If `allow_creation=false`, then `nothing` is returned if no workspace exists, instead of creating one.
"""
function get_workspace(session_notebook::SN; allow_creation::Bool=true, async::Bool=false)::Union{Nothing,Workspace,Task}
    session, notebook = session_notebook
    if notebook.notebook_id in discarded_workspaces
        @debug "This should not happen" notebook.process_status
        throw(DiscardedWorkspaceException(notebook.notebook_id))
    end

    task = withtoken(get_workspace_token) do
        if !allow_creation
            get(active_workspaces, notebook.notebook_id, nothing)
        else
            get!(active_workspaces, notebook.notebook_id) do
                🌸 = Pluto.@asynclog make_workspace(session_notebook)
                yield(); 🌸
            end
        end
    end

    isnothing(task) ? nothing : async ? task : fetch(task)
end
get_workspace(workspace::Workspace; kwargs...)::Workspace = workspace

"Try our best to delete the workspace. `Workspace` will have its worker process terminated."
function unmake_workspace(session_notebook::SN; async::Bool=false, verbose::Bool=true, allow_restart::Bool=true)
    session, notebook = session_notebook
    workspace = get_workspace(session_notebook; allow_creation=false)
    workspace === nothing && return
    workspace.discarded = true
    allow_restart || push!(discarded_workspaces, notebook.notebook_id)

    filter!(p -> fetch(p.second).worker != workspace.worker, active_workspaces)
    t = @async begin
        interrupt_workspace(workspace; verbose=false)
        Malt.stop(workspace.worker)
    end
    async || wait(t)
    nothing
end

function workspace_exception_result(ex::Union{Base.IOError, Malt.TerminatedWorkerException, Distributed.ProcessExitedException}, workspace::Workspace)
    (
        output_formatted=PlutoRunner.format_output(CapturedException(ex, [])),
        errored=true,
        interrupted=true,
        process_exited=true && !workspace.discarded, # don't report a process exit if the workspace was discarded on purpose
        runtime=nothing,
        published_objects=Dict{String,Any}(),
        has_pluto_hook_features=false,
    )
end

workspace_exception_result(exs::CompositeException, workspace::Workspace) = workspace_exception_result(first(exs.exceptions), workspace)

function workspace_exception_result(ex::Exception, workspace::Workspace)
    if ex isa InterruptException || (ex isa Malt.RemoteException && occursin("InterruptException", ex.message))
        @info "Found an interrupt!" ex
        (
            output_formatted=PlutoRunner.format_output(CapturedException(InterruptException(), [])),
            errored=true,
            interrupted=true,
            process_exited=false,
            runtime=nothing,
            published_objects=Dict{String,Any}(),
            has_pluto_hook_features=false,
        )
    else
        @error "Unkown error during eval_format_fetch_in_workspace" ex
        (
            output_formatted=PlutoRunner.format_output(CapturedException(ex, [])),
            errored=true,
            interrupted=true,
            process_exited=!Malt.isrunning(workspace.worker) && !workspace.discarded, # don't report a process exit if the workspace was discarded on purpose
            runtime=nothing,
            published_objects=Dict{String,Any}(),
            has_pluto_hook_features=false,
        )
    end
end


"""
Evaluate expression inside the workspace - output is fetched and formatted,
errors are caught and formatted. Returns formatted output and error flags.

`expr` has to satisfy `ExpressionExplorer.is_toplevel_expr`.
"""
function eval_format_fetch_in_workspace(
    session_notebook::Union{SN,Workspace},
    expr::Expr,
    cell_id::UUID;
    ends_with_semicolon::Bool=false,
    function_wrapped_info::Union{Nothing,Tuple}=nothing,
    forced_expr_id::Union{PlutoRunner.ObjectID,Nothing}=nothing,
    known_published_objects::Vector{String}=String[],
    user_requested_run::Bool=true,
    capture_stdout::Bool=true,
    code_is_effectful::Bool=true,
)::PlutoRunner.FormattedCellResult

    workspace = get_workspace(session_notebook)
    is_on_this_process = workspace.worker isa Malt.InProcessWorker

    # if multiple notebooks run on the same process, then we need to `cd` between the different notebook paths
    if session_notebook isa Tuple
        use_nbpkg_environment(session_notebook, workspace)
    end

    # Run the code 🏃

    # A try block (on this process) to catch an InterruptException
    take!(workspace.dowork_token)
    workspace.has_executed_effectful_code |= code_is_effectful
    early_result = try
        Malt.remote_eval_wait(workspace.worker, quote
            PlutoRunner.run_expression(
                getfield(Main, $(QuoteNode(workspace.module_name))),
                $(QuoteNode(expr)),
                $(workspace.notebook_id),
                $cell_id,
                $function_wrapped_info,
                $forced_expr_id;
                user_requested_run=$user_requested_run,
                capture_stdout=$(capture_stdout && !is_on_this_process),
            )
        end)
        put!(workspace.dowork_token)
        nothing
    catch e
        # Don't use a `finally` because the token needs to be back asap for the interrupting code to pick it up.
        put!(workspace.dowork_token)
        workspace_exception_result(e, workspace)
    end

    if early_result === nothing
        format_fetch_in_workspace(workspace, cell_id, ends_with_semicolon, known_published_objects; capture_stdout)
    else
        early_result
    end
end

"Evaluate expression inside the workspace - output is not fetched, errors are rethrown. For internal use."
function eval_in_workspace(session_notebook::Union{SN,Workspace}, expr)
    workspace = get_workspace(session_notebook)

    Malt.remote_eval_wait(workspace.worker, quote
        Core.eval($(workspace.module_name), $(QuoteNode(expr)))
    end)
    nothing
end

function format_fetch_in_workspace(
    session_notebook::Union{SN,Workspace},
    cell_id,
    ends_with_semicolon,
    known_published_objects::Vector{String}=String[],
    showmore_id::Union{PlutoRunner.ObjectDimPair,Nothing}=nothing;
    capture_stdout::Bool=true,
)::PlutoRunner.FormattedCellResult
    workspace = get_workspace(session_notebook)

    # Instead of fetching the output value (which might not make sense in our context,
    # since the user can define structs, types, functions, etc),
    # we format the cell output on the worker, and fetch the formatted output.
    withtoken(workspace.dowork_token) do
        try
            Malt.remote_eval_fetch(workspace.worker, quote
                PlutoRunner.formatted_result_of(
                    $(workspace.notebook_id),
                    $cell_id,
                    $ends_with_semicolon,
                    $known_published_objects,
                    $showmore_id,
                    getfield(Main, $(QuoteNode(workspace.module_name)));
                    capture_stdout=$capture_stdout,
                )
            end)
        catch e
            workspace_exception_result(CompositeException([e]), workspace)
        end
    end
end

function collect_soft_definitions(session_notebook::SN, modules::Set{Expr})
    workspace = get_workspace(session_notebook)

    Malt.remote_eval_fetch(workspace.worker, quote
        PlutoRunner.collect_soft_definitions($(workspace.module_name), $modules)
    end)
end

function macroexpand_in_workspace(session_notebook::SN, macrocall, cell_id, module_name = Symbol(""); capture_stdout::Bool=true)::Tuple{Bool, Any}
    workspace = get_workspace(session_notebook)
    module_name = module_name === Symbol("") ? workspace.module_name : module_name

    Malt.remote_eval_fetch(workspace.worker, quote
        try
            (true, PlutoRunner.try_macroexpand($(module_name), $(workspace.notebook_id), $(cell_id), $(macrocall |> QuoteNode); capture_stdout=$(capture_stdout)))
        catch error
            # We have to be careful here, for example a thrown `MethodError()` will contain the called method and arguments.
            # which normally would be very useful for debugging, but we can't serialize it!
            # So we make sure we only serialize the exception we know about, and string-ify the others.
            if error isa UndefVarError
                (false, UndefVarError(error.var))
            elseif error isa LoadError && error.error isa UndefVarError
                (false, UndefVarError(error.error.var))
            else
                (false, ErrorException(sprint(showerror, error)))
            end
        end
    end)
end

"Evaluate expression inside the workspace - output is returned. For internal use."
function eval_fetch_in_workspace(session_notebook::Union{SN,Workspace}, expr)
    workspace = get_workspace(session_notebook)

    Malt.remote_eval_fetch(workspace.worker, quote
        Core.eval($(workspace.module_name), $(QuoteNode(expr)))
    end)
end

function do_reimports(session_notebook::Union{SN,Workspace}, module_imports_to_move::Set{Expr})
    workspace = get_workspace(session_notebook)

    Malt.remote_eval_wait(workspace.worker, quote
        PlutoRunner.do_reimports($(workspace.module_name), $module_imports_to_move)
    end)
end

"""
Move variables to a new module. A given set of variables to be 'deleted' will
not be moved to the new module, making them unavailable.
"""
function move_vars(
    session_notebook::Union{SN,Workspace},
    old_workspace_name::Symbol,
    new_workspace_name::Union{Nothing,Symbol},
    to_delete::Set{Symbol},
    methods_to_delete::Set{Tuple{UUID,Tuple{Vararg{Symbol}}}},
    module_imports_to_move::Set{Expr},
    cells_to_macro_invalidate::Set{UUID},
    cells_to_js_link_invalidate::Set{UUID},
    keep_registered::Set{Symbol}=Set{Symbol}();
    kwargs...
)

    workspace = get_workspace(session_notebook)
    new_workspace_name = something(new_workspace_name, workspace.module_name)

    Malt.remote_eval_wait(workspace.worker, quote
        PlutoRunner.move_vars(
            $(QuoteNode(old_workspace_name)),
            $(QuoteNode(new_workspace_name)),
            $to_delete,
            $methods_to_delete,
            $module_imports_to_move,
            $cells_to_macro_invalidate,
            $cells_to_js_link_invalidate,
            $keep_registered,
        )
    end)
end

function move_vars(
    session_notebook::Union{SN,Workspace},
    to_delete::Set{Symbol},
    methods_to_delete::Set{Tuple{UUID,Tuple{Vararg{Symbol}}}},
    module_imports_to_move::Set{Expr},
    cells_to_macro_invalidate::Set{UUID},
    cells_to_js_link_invalidate::Set{UUID};
    kwargs...
)
    move_vars(
        session_notebook,
        bump_workspace_module(session_notebook)...,
        to_delete,
        methods_to_delete,
        module_imports_to_move,
        cells_to_macro_invalidate,
        cells_to_js_link_invalidate;
        kwargs...
    )
end


"""
```julia
poll(query::Function, timeout::Real=Inf64, interval::Real=1/20)::Bool
```

Keep running your function `query()` in intervals until it returns `true`, or until `timeout` seconds have passed.

`poll` returns `true` if `query()` returned `true`. If `timeout` seconds have passed, `poll` returns `false`.

# Example
```julia
vals = [1,2,3]

@async for i in 1:5
    sleep(1)
    vals[3] = 99
end

poll(8 #= seconds =#) do
    vals[3] == 99
end # returns `true` (after 5 seconds)!

###

@async for i in 1:5
    sleep(1)
    vals[3] = 5678
end

poll(2 #= seconds =#) do
    vals[3] == 5678
end # returns `false` (after 2 seconds)!
```
"""
function poll(query::Function, timeout::Real=Inf64, interval::Real=1/20)
    start = time()
    while time() < start + timeout
        if query()
            return true
        end
        sleep(interval)
    end
    return false
end

"Force interrupt (SIGINT) a workspace, return whether successful"
function interrupt_workspace(session_notebook::Union{SN,Workspace}; verbose=true)::Bool
    workspace = get_workspace(session_notebook; allow_creation=false)

    if !(workspace isa Workspace)
        # verbose && @info "Can't interrupt this notebook: it is not running."
        return false
    end

    if poll(() -> isready(workspace.dowork_token), 2.0, 5/100)
        verbose && println("Cell finished, other cells cancelled!")
        return true
    end

    if (workspace.worker isa Malt.DistributedStdlibWorker) && Sys.iswindows()
        verbose && @warn "Stopping cells is not yet supported on Windows, but it will be soon!\n\nYou can already try out this new functionality with:\n\nPluto.run(workspace_use_distributed_stdlib=false)\n\nLet us know what you think!"
        return false
    end

    if isready(workspace.dowork_token)
        verbose && @info "Tried to stop idle workspace - ignoring."
        return true
    end

    # You can force kill a julia process by pressing Ctrl+C five times 🙃
    # But this is not very consistent, so we will just keep pressing Ctrl+C until the workspace isn't running anymore.
    # TODO: this will also kill "pending" evaluations, and any evaluations started within 100ms of the kill. A global "evaluation count" would fix this.
    # TODO: listen for the final words of the remote process on stdout/stderr: "Force throwing a SIGINT"
    try
        verbose && @info "Sending interrupt to process $(summary(workspace.worker))"
        Malt.interrupt(workspace.worker)

        if poll(() -> isready(workspace.dowork_token), 5.0, 5/100)
            verbose && println("Cell interrupted!")
            return true
        end

        verbose && println("Still running... starting sequence")
        while !isready(workspace.dowork_token)
            for _ in 1:5
                verbose && print(" 🔥 ")
                Malt.interrupt(workspace.worker)
                sleep(0.18)
                if isready(workspace.dowork_token)
                    break
                end
            end
            sleep(1.5)
        end
        verbose && println()
        verbose && println("Cell interrupted!")
        true
    catch e
        if !(e isa KeyError)
            @warn "Interrupt failed for unknown reason"
            showerror(e, stacktrace(catch_backtrace()))
        end
        false
    end
end

end
