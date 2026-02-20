
import ExpressionExplorer: external_package_names
import .PkgCompat
import .PkgCompat: select, is_stdlib
import Logging
import LoggingExtras
import GracefulPkg
import TOML

const tiers = unique((
    Pkg.PRESERVE_ALL_INSTALLED,
	Pkg.PRESERVE_ALL,
	Pkg.PRESERVE_DIRECT,
	Pkg.PRESERVE_SEMVER,
	Pkg.PRESERVE_NONE,
))

const pkg_token = Token()

_default_cleanup() = nothing

# This list appears multiple times in our codebase. Be sure to match edits everywhere.
function use_plutopkg(topology::NotebookTopology)
    !any(values(topology.nodes)) do node
        Symbol("Pkg.activate") ∈ node.references ||
        Symbol("Pkg.API.activate") ∈ node.references ||
        Symbol("Pkg.develop") ∈ node.references ||
        Symbol("Pkg.API.develop") ∈ node.references ||
        Symbol("Pkg.add") ∈ node.references ||
        Symbol("Pkg.API.add") ∈ node.references ||
        Symbol("TestEnv.activate") ∈ node.references ||
        # https://juliadynamics.github.io/DrWatson.jl/dev/project/#DrWatson.quickactivate
        Symbol("quickactivate") ∈ node.references ||
        Symbol("@quickactivate") ∈ node.references ||
        Symbol("DrWatson.@quickactivate") ∈ node.references ||
        Symbol("DrWatson.quickactivate") ∈ node.references
    end
end

PkgCompat.project_file(notebook::Notebook) = PkgCompat.project_file(PkgCompat.env_dir(notebook.nbpkg_ctx))
PkgCompat.manifest_file(notebook::Notebook) = PkgCompat.manifest_file(PkgCompat.env_dir(notebook.nbpkg_ctx))


"""
Update the notebook package environment to match the notebook's code. This will:
- Add packages that should be added (because they are imported in a cell).
- Remove packages that are no longer needed.
- Make sure that the environment is instantiated.
- Detect the use of `Pkg.activate` and enable/disabled nbpkg accordingly.
"""
function sync_nbpkg_core(
    notebook::Notebook, 
    old_topology::NotebookTopology, 
    new_topology::NotebookTopology; 
    on_terminal_output::Function=((args...) -> nothing), 
    cleanup_iolistener::Ref{Function}=Ref{Function}(_default_cleanup),
    lag::Real=0,
    precompile_session::ServerSession,
)
    pkg_status = Status.report_business_started!(notebook.status_tree, :pkg)
    Status.report_business_started!(pkg_status, :analysis)
    
    👺 = false

    use_plutopkg_old = notebook.nbpkg_ctx !== nothing
    use_plutopkg_new = use_plutopkg(new_topology)
    
    if !use_plutopkg_old && use_plutopkg_new
        @debug "PlutoPkg: Started using PlutoPkg!! HELLO reproducibility!" notebook.path

        👺 = true
        notebook.nbpkg_ctx = PkgCompat.create_empty_ctx()
        notebook.nbpkg_install_time_ns = 0
    end
    if use_plutopkg_old && !use_plutopkg_new
        @debug "PlutoPkg: Stopped using PlutoPkg 💔😟😢" notebook.path

        no_packages_loaded_yet = (
            notebook.nbpkg_restart_required_msg === nothing &&
            notebook.nbpkg_restart_recommended_msg === nothing &&
            all(PkgCompat.is_stdlib, keys(PkgCompat.project(notebook.nbpkg_ctx).dependencies))
        )
        👺 = !no_packages_loaded_yet
        notebook.nbpkg_ctx = nothing
        notebook.nbpkg_install_time_ns = nothing
    end
    if !use_plutopkg_new
        notebook.nbpkg_install_time_ns = nothing
        notebook.nbpkg_ctx_instantiated = true
    end
    
    (lag > 0) && sleep(lag * (0.5 + rand())) # sleep(0) would yield to the process manager which we dont want

    if use_plutopkg_new
        @assert notebook.nbpkg_ctx !== nothing
        
        PkgCompat.mark_original!(notebook.nbpkg_ctx)

        old_packages = String.(keys(PkgCompat.project(notebook.nbpkg_ctx).dependencies))
        new_packages = String.(external_package_names(new_topology)) # search all cells for imports and usings
        
        removed = setdiff(old_packages, new_packages)
        added = setdiff(new_packages, old_packages, PkgCompat.sysimage_module_names())  # Avoid adding the modules of the sysimage
        can_skip = isempty(removed) && isempty(added) && notebook.nbpkg_ctx_instantiated

        iolistener = let
            busy_packages = notebook.nbpkg_ctx_instantiated ? union(added, removed) : new_packages
            report_to = ["nbpkg_sync", busy_packages...]
            IOListener(callback=(s -> on_terminal_output(report_to, freeze_loading_spinners(s))))
        end
        cleanup_iolistener[] = () -> stoplistening(iolistener)



        Status.report_business_finished!(pkg_status, :analysis)
        
        # We remember which Pkg.Types.PreserveLevel was used. If it's too low, we will recommend/require a notebook restart later.
        local used_tier = first(tiers)
        if !can_skip
            # We have a global lock, `pkg_token`, on Pluto-managed Pkg operations, which is shared between all notebooks. If this lock is not ready right now then that means that we are going to wait at the `withtoken(pkg_token)` line below. 
            # We want to report that we are waiting, with a best guess of why.
            wait_business = if !isready(pkg_token)
                reg = !PkgCompat._updated_registries_compat[]
                
                # Print something in the terminal logs
                phasemessage(iolistener, "Waiting for $(reg ? "the package registry to update" : "other notebooks to finish Pkg operations")")
                trigger(iolistener) # manual trigger because we did not start listening yet
                
                # Create a business item
                Status.report_business_started!(pkg_status, 
                    reg ? :registry_update : :waiting_for_others
                )
            end
            
            return withtoken(pkg_token) do
                withlogcapture(iolistener) do

                    let # Status stuff
                        isnothing(wait_business) || Status.report_business_finished!(wait_business)
                        
                        if !notebook.nbpkg_ctx_instantiated
                            Status.report_business_planned!(pkg_status, :instantiate1)
                            Status.report_business_planned!(pkg_status, :resolve)
                            Status.report_business_planned!(pkg_status, :precompile)
                        end
                        
                        isempty(removed) || Status.report_business_planned!(pkg_status, :remove)
                        isempty(added) || Status.report_business_planned!(pkg_status, :add)
                        if !isempty(added) || !isempty(removed)
                            Status.report_business_planned!(pkg_status, :instantiate2)
                            Status.report_business_planned!(pkg_status, :precompile)
                        end
                    end
                    
                    should_precompile_later = false
                    
                    PkgCompat.refresh_registry_cache()
                    PkgCompat.clear_stdlib_compat_entries!(notebook.nbpkg_ctx)
                    
                    
                    should_instantiate_initially = !notebook.nbpkg_ctx_instantiated
                    if should_instantiate_initially
                        
                        should_precompile_later = true
                        
                        # Resolve the package environment, using GracefulPkg.jl to solve any issues
                        Status.report_business!(pkg_status, :resolve) do
                            with_auto_fixes(notebook, iolistener) do
                                _resolve(notebook, iolistener)
                            end
                        end
                        
                        Status.report_business!(pkg_status, :instantiate1) do
                            _instantiate(notebook, iolistener)
                        end
                    end
                    
                    to_add = filter(PkgCompat.package_exists, added)
                    to_remove = filter(removed) do p
                        haskey(PkgCompat.project(notebook.nbpkg_ctx).dependencies, p)
                    end
                    @debug "PlutoPkg:" notebook.path to_add to_remove
                    
                    if !isempty(to_remove)
                        Status.report_business_started!(pkg_status, :remove)
                        # See later comment
                        mkeys() = Set(filter(!is_stdlib, [m.name for m in values(PkgCompat.dependencies(notebook.nbpkg_ctx))]))
                        old_manifest_keys = mkeys()

                        with_io_setup(notebook, iolistener) do
                            Pkg.rm(notebook.nbpkg_ctx, [
                                Pkg.PackageSpec(name=p)
                                for p in to_remove
                            ])
                        end

                        notebook.nbpkg_install_time_ns = nothing # we lose our estimate of install time
                        # We record the manifest before and after, to prevent recommending a reboot when nothing got removed from the manifest (e.g. when removing GR, but leaving Plots), or when only stdlibs got removed.
                        new_manifest_keys = mkeys()
                        
                        # TODO: we might want to upgrade other packages now that constraints have loosened? Does this happen automatically?
                        Status.report_business_finished!(pkg_status, :remove)
                    end

                    
                    # TODO: instead of Pkg.PRESERVE_ALL, we actually want:
                    # "Pkg.PRESERVE_DIRECT, but preserve exact verisons of Base.loaded_modules"
                    
                    if !isempty(to_add)
                        Status.report_business_started!(pkg_status, :add)
                        start_time = time_ns()
                        with_io_setup(notebook, iolistener) do
                            phasemessage(iolistener, "Adding packages")
                            
                            # We temporarily clear the "semver-compatible" [deps] entries, because Pkg already respects semver, unless it doesn't, in which case we don't want to force it.
                            PkgCompat.clear_auto_compat_entries!(notebook.nbpkg_ctx)

                            try
                                for tier in tiers
                                    used_tier = tier

                                    try
                                        withenv("JULIA_PKG_PRECOMPILE_AUTO" => 0) do
                                            Pkg.add(notebook.nbpkg_ctx, [
                                                Pkg.PackageSpec(name=p)
                                                for p in to_add
                                            ]; preserve=used_tier)
                                        end

                                        break
                                    catch e
                                        if used_tier == Pkg.PRESERVE_NONE
                                            # give up
                                            rethrow(e)
                                        end
                                    end
                                end
                            finally
                                PkgCompat.write_auto_compat_entries!(notebook.nbpkg_ctx)
                            end

                            # Now that Pkg is set up, the notebook process will call `using Package`, which can take some time. We write this message to the io, to notify the user.
                            println(iolistener.buffer, "\e[32m\e[1mLoading\e[22m\e[39m packages...")
                        end
                    
                        notebook.nbpkg_install_time_ns = notebook.nbpkg_install_time_ns === nothing ? nothing : (notebook.nbpkg_install_time_ns + (time_ns() - start_time))
                        Status.report_business_finished!(pkg_status, :add)
                        @debug "PlutoPkg: done" notebook.path 
                    end

                    should_instantiate_again = !notebook.nbpkg_ctx_instantiated || !isempty(to_add) || !isempty(to_remove)
                    
                    if should_instantiate_again
                        should_precompile_later = true
                        Status.report_business!(pkg_status, :instantiate2) do
                            _instantiate(notebook, iolistener)
                        end
                    end
                    
                    if should_precompile_later
                        Status.report_business!(pkg_status, :precompile) do
                            _precompile(precompile_session, notebook, iolistener)
                        end
                    end

                    stoplistening(iolistener)
                    Status.report_business_finished!(pkg_status)

                    return (;
                        did_something=👺 || (
                            should_instantiate_initially || should_instantiate_again || (use_plutopkg_old != use_plutopkg_new)
                        ),
                        used_tier=used_tier,
                        # changed_versions=Dict{String,Pair}(),
                        restart_recommended=👺 || (
                            (!isempty(to_remove) && old_manifest_keys != new_manifest_keys) ||
                            used_tier ∉ (Pkg.PRESERVE_ALL, Pkg.PRESERVE_ALL_INSTALLED)
                        ),
                        restart_required=👺 || (
                            used_tier ∈ (Pkg.PRESERVE_SEMVER, Pkg.PRESERVE_NONE)
                        ),
                    )
                end
            end
        end
    end
    Status.report_business_finished!(pkg_status)

    return (
        did_something=👺 || (use_plutopkg_old != use_plutopkg_new),
        used_tier=Pkg.PRESERVE_ALL_INSTALLED,
        # changed_versions=Dict{String,Pair}(),
        restart_recommended=👺 || false,
        restart_required=👺 || false,
    )
end

"""
```julia
sync_nbpkg(session::ServerSession, notebook::Notebook; save::Bool=true)
```

In addition to the steps performed by [`sync_nbpkg_core`](@ref):
- Capture terminal outputs and store them in the `notebook`
- Update the clients connected to `notebook`
- `try` `catch` and reset the package environment on failure.
"""
function sync_nbpkg(session, notebook, old_topology::NotebookTopology, new_topology::NotebookTopology; save::Bool=true, take_token::Bool=true)
    @assert will_run_pkg(notebook)

    cleanup_iolistener = Ref{Function}(_default_cleanup)
	try
        Status.report_business_started!(notebook.status_tree, :pkg)
        
        pkg_result = (take_token ? withtoken : (f, _) -> f())(notebook.executetoken) do
			function iocallback(pkgs, s)
				notebook.nbpkg_busy_packages = pkgs
				for p in pkgs
					notebook.nbpkg_terminal_outputs[p] = s
				end
                # incoming IO is a good sign that something might have changed, so we update the cache.
                update_nbpkg_cache!(notebook)
                
                # This is throttled "automatically":
                # If io is coming in very fast, then it won't build up a queue of updates for the client. That's because `send_notebook_changes!` is a blocking call, including the websocket transfer. So this `iocallback` function will only return when the last message has been sent.
                # The nice thing is that IOCallback is not actually implemented as a callback when IO comes in, but it is an async loop that sleeps, maybe calls iocallback with the latest buffer content, and repeats. So a blocking iocallback avoids overflowing the queue.
				send_notebook_changes!(ClientRequest(; session, notebook))
			end
			sync_nbpkg_core(
                notebook, 
                old_topology, 
                new_topology; 
                on_terminal_output=iocallback, 
                cleanup_iolistener,
                lag=session.options.server.simulated_pkg_lag,
                precompile_session=session,
            )
		end

		if pkg_result.did_something
			@debug "PlutoPkg: success!" notebook.path pkg_result
            
            if _has_executed_effectful_code(session, notebook)
                if pkg_result.restart_recommended
                    notebook.nbpkg_restart_recommended_msg = "Yes, something changed during regular sync."
                    @debug "PlutoPkg: Notebook restart recommended" notebook.path notebook.nbpkg_restart_recommended_msg
                end
                if pkg_result.restart_required
                    notebook.nbpkg_restart_required_msg = "Yes, something changed during regular sync."
                    @debug "PlutoPkg: Notebook restart REQUIRED" notebook.path notebook.nbpkg_restart_required_msg
                end
            end

			notebook.nbpkg_busy_packages = String[]
            update_nbpkg_cache!(notebook)
			send_notebook_changes!(ClientRequest(; session, notebook))
			save && save_notebook(session, notebook)
		end
	catch e
		bt = catch_backtrace()
		Status.report_business_finished!(notebook.status_tree, :pkg, false)
		old_packages = try String.(keys(PkgCompat.project(notebook.nbpkg_ctx).dependencies)); catch; ["unknown"] end
		new_packages = try String.(external_package_names(new_topology)); catch; ["unknown"] end
		@warn """
		PlutoPkg: Failed to add/remove packages! Resetting package environment...
		""" PLUTO_VERSION VERSION old_packages new_packages exception=(e, bt)
		# TODO: send to user
        showerror(stderr, e, bt)
        
        
		error_text = e isa WorkspaceManager.PrecompilationFailedException ? e.msg : sprint(showerror, e, bt)
		for p in notebook.nbpkg_busy_packages
            old = get(notebook.nbpkg_terminal_outputs, p, "")
			notebook.nbpkg_terminal_outputs[p] = old * "\n\n\e[1mPkg error!\e[22m\n" * error_text
		end
		notebook.nbpkg_busy_packages = String[]
        update_nbpkg_cache!(notebook)
		send_notebook_changes!(ClientRequest(; session, notebook))

		# Clear the embedded Project and Manifest and require a restart from the user.
		reset_nbpkg!(notebook, new_topology; keep_project=false, save=save)
		notebook.nbpkg_restart_required_msg = "Yes, because sync_nbpkg_core failed. \n\n$(error_text)"
        notebook.nbpkg_install_time_ns = nothing
        notebook.nbpkg_ctx_instantiated = false
        update_nbpkg_cache!(notebook)
		send_notebook_changes!(ClientRequest(; session, notebook))

		save && save_notebook(session, notebook)
	finally
        cleanup_iolistener[]()
        Status.report_business_finished!(notebook.status_tree, :pkg)
    end
end

function _has_executed_effectful_code(session::ServerSession, notebook::Notebook)
    workspace = WorkspaceManager.get_workspace((session, notebook); allow_creation=false)
    workspace === nothing ? false : workspace.has_executed_effectful_code
end
    

function writebackup(notebook::Notebook)
    backup_path = backup_filename(notebook.path)
    Pluto.readwrite(notebook.path, backup_path)

    @info "Backup saved to" backup_path

    backup_path
end


function _instantiate(notebook::Notebook, iolistener::IOListener)
    start_time = time_ns()
    with_io_setup(notebook, iolistener) do
        phasemessage(iolistener, "Instantiating")
        @debug "PlutoPkg: Instantiating" notebook.path 
        
        # update registries if this is the first time
        PkgCompat.update_registries(; force=false)
        
        # Pkg.instantiate assumes that the environment to be instantiated is active, so we will have to modify the LOAD_PATH of this Pluto server
        # We could also run the Pkg calls on the notebook process, but somehow I think that doing it on the server is more charming, though it requires this workaround.
        env_dir = PkgCompat.env_dir(notebook.nbpkg_ctx)
        pushfirst!(LOAD_PATH, env_dir)
        
        try
            # instantiate without forcing registry update
            PkgCompat.instantiate(notebook.nbpkg_ctx; update_registry=false, allow_autoprecomp=false)
        finally
            # reset the LOAD_PATH
            if LOAD_PATH[1] == env_dir
                popfirst!(LOAD_PATH)
            else
                @warn "LOAD_PATH modified during Pkg.instantiate... this is unexpected!"
            end
        end
    end
    notebook.nbpkg_install_time_ns = notebook.nbpkg_install_time_ns === nothing ? nothing : (notebook.nbpkg_install_time_ns + (time_ns() - start_time))
    notebook.nbpkg_ctx_instantiated = true
end

function _precompile(session::ServerSession, notebook::Notebook, iolistener::IOListener)
    start_time = time_ns()
    with_io_setup(notebook, iolistener) do
        phasemessage(iolistener, "Precompiling")
        @debug "PlutoPkg: Precompiling" notebook.path 
        success = WorkspaceManager.precompile_nbpkg((session, notebook); io=iolistener.buffer)
        if !success
            println(iolistener.buffer, "Precompilation skipped because the process has shut down.")
        end
    end
    notebook.nbpkg_install_time_ns = notebook.nbpkg_install_time_ns === nothing ? nothing : (notebook.nbpkg_install_time_ns + (time_ns() - start_time))
end

function _resolve(notebook::Notebook, iolistener::IOListener)
    with_io_setup(notebook, iolistener) do
        phasemessage(iolistener, "Resolving")
        @debug "PlutoPkg: Resolving" notebook.path 
        Pkg.resolve(notebook.nbpkg_ctx)
    end
end


const gracefulpkg_strats = filter!(collect(GracefulPkg.DEFAULT_STRATEGIES)) do strat
    !(strat isa GracefulPkg.StrategyRemoveProject)
end

const gracefulpkg_strats_project_edit = GracefulPkg.Strategy[
    GracefulPkg.StrategyDoNothing(),
    GracefulPkg.StrategyRemoveManifest(),
]

const StrategyThatRequiresReinstantiation = Union{
    GracefulPkg.StrategyLoosenCompat,
    GracefulPkg.StrategyRemoveManifest,
    GracefulPkg.StrategyRemoveManifestAndCompat,
    GracefulPkg.StrategyRemoveProject,
}


"""
Run `f` (e.g. `Pkg.instantiate`) on the notebook's package environment. Keep trying more and more invasive strategies to fix problems until the operation succeeds.
"""
function with_auto_fixes(f::Function, notebook::Notebook, iolistener::IOListener; strategies=gracefulpkg_strats)
    env_dir = PkgCompat.env_dir(notebook.nbpkg_ctx)
    
    is_first = Ref(true)
    report = 
    with_io_setup(notebook, iolistener) do
        GracefulPkg.gracefully(; env_dir, throw=false, strategies) do
            try
                if !is_first[]
                    PkgCompat.load_ctx!(notebook.nbpkg_ctx, env_dir)
                end

                f()
            finally
                is_first[] = false
            end
        end
    end

    steps = report.strategy_reports
    
    if any(x -> x.strategy isa StrategyThatRequiresReinstantiation, steps)
        notebook.nbpkg_ctx_instantiated = false
    end
    
    if !GracefulPkg.is_success(report)
        throw(GracefulPkg.NothingWorked(report))
    end

    report
end


function edit_project_toml(
    session::ServerSession, notebook::Notebook, original_project_toml::String, new_project_toml::String;
    run_async::Bool=false,
    backup::Bool=true, save::Bool=true,
)
    if strip(original_project_toml) == strip(new_project_toml)
        return
    end
    if occursin("[sources", new_project_toml) && VERSION < v"1.12.0"
        error("[sources] is not supported in this Julia version.")
    end
    
    
    backup && save && writebackup(notebook)
    
    @assert notebook.nbpkg_ctx !== nothing "This notebook is not using the Pluto package manager."
    
    p = PkgCompat.project_file(notebook)
    @assert original_project_toml == read(p, String) "The notebook environment was modified by another process during your edits. Please try again."
    
    ##############
    
    pkg_status = Status.report_business_started!(notebook.status_tree, :pkg)
    Status.report_business_planned!(pkg_status, :write_project_toml)
    Status.report_business_planned!(pkg_status, :resolve)
    Status.report_business_planned!(pkg_status, :instantiate1)
    Status.report_business_planned!(pkg_status, :precompile)
    
    # TODO: put this in a separate function
    function iocallback(pkgs, s)
        notebook.nbpkg_busy_packages = pkgs
        for p in pkgs
            notebook.nbpkg_terminal_outputs[p] = s
        end
        update_nbpkg_cache!(notebook)
        send_notebook_changes!(ClientRequest(; session, notebook))
    end
    
    iolistener = let
        report_to = ["nbpkg_sync", "nbpkg_edit"]
        IOListener(callback=(s -> iocallback(report_to, freeze_loading_spinners(s))))
    end
    iolistener_buffer = iolistener.buffer
    
    maybe_async(run_async) do
        withtoken(pkg_token) do
            withtoken(notebook.executetoken) do
                withlogcapture(iolistener) do
                    with_io_setup(notebook, iolistener) do
                        try
                            function recache()
                                PkgCompat.load_ctx!(notebook.nbpkg_ctx)
                                PkgCompat._update_project_hash!(notebook.nbpkg_ctx)
                            end
                            
                            Status.report_business!(pkg_status, :write_project_toml) do
                                write(p, new_project_toml)
                                
                                recache()
                            end
                            
                            # The GracefulPkg strategies to use for `resolve`
                            strategies = let
                                s(str) = try
                                    get(TOML.parse(str), "sources", nothing)
                                catch
                                    nothing
                                end
                                sources_changed = s(original_project_toml) != s(new_project_toml)

                                sources_changed ? 
                                    # Sources changed, so we remove the Manifest directly, to get latest things from sources.
                                    GracefulPkg.Strategy[GracefulPkg.StrategyRemoveManifest()] : 
                                    # We use GracefulPkg here with only 2 strategies: DoNothing and RemoveManifest. The first one is a regular "resolve". The second one is more like an "update".
                                    gracefulpkg_strats_project_edit
                            end
                            
                            local report
                            Status.report_business!(pkg_status, :resolve) do
                                report = with_auto_fixes(
                                    notebook, iolistener; 
                                    strategies
                                ) do
                                    recache()
                                    _resolve(notebook, iolistener)
                                end
                                
                                # this might have updated packages, so let's update the auto-compat entries.
                                PkgCompat.clear_auto_compat_entries!(notebook.nbpkg_ctx)
                                PkgCompat.write_auto_compat_entries!(notebook.nbpkg_ctx)
                            end
                            
                            Status.report_business!(pkg_status, :instantiate1) do
                                _instantiate(notebook, iolistener)
                            end
                            Status.report_business!(pkg_status, :precompile) do
                                _precompile(session, notebook, iolistener)
                            end
                            
                            # Show the report.
                            @isdefined(report) && Base.show(iolistener.buffer, MIME"text/plain"(), report)
                        catch e
                            printstyled(iolistener.buffer, "PlutoPkg: Failed to synchronize Project.toml\n"; color=:light_red, bold=true)
                            showerror(iolistener.buffer, e)
                            # @error "PlutoPkg: Failed to synchronize Project.toml" notebook.path exception=(e, catch_backtrace())
                            Status.report_business_finished!(pkg_status, false)
                        end
                    end
                    if _has_executed_effectful_code(session, notebook)
                        notebook.nbpkg_restart_required_msg = "Yes, something changed during Project.toml synchronization."
                    end
                    stoplistening(iolistener)
                    Status.report_business_finished!(pkg_status)
                end
            end
        end
        
        update_nbpkg_cache!(notebook)
        send_notebook_changes!(ClientRequest(; session, notebook))
        save && save_notebook(session, notebook)
    end
end


"""
Reset the package environment of a notebook. This will remove the `Project.toml` and `Manifest.toml` files from the notebook's secret package environment folder, and if `save` is `true`, it will then save the notebook without embedded Project and Manifest.

If `keep_project` is `true` (default `false`), the `Project.toml` file will be kept, but the `Manifest.toml` file will be removed.

This function is useful when we are not able to resolve/activate/instantiate a notebook's environment after loading, which happens when e.g. the environment was created on a different OS or Julia version.
"""
function reset_nbpkg!(notebook::Notebook, topology::Union{NotebookTopology,Nothing}=nothing; keep_project::Bool=false, backup::Bool=true, save::Bool=true)
    backup && save && writebackup(notebook)

    if notebook.nbpkg_ctx !== nothing
        p = PkgCompat.project_file(notebook)
        m = PkgCompat.manifest_file(notebook)
        keep_project || (isfile(p) && rm(p))
        isfile(m) && rm(m)

        PkgCompat.load_ctx!(notebook.nbpkg_ctx, PkgCompat.env_dir(notebook.nbpkg_ctx))
    else
        notebook.nbpkg_ctx = if use_plutopkg(something(topology, notebook.topology))
            PkgCompat.load_empty_ctx!(notebook.nbpkg_ctx)
        else
            nothing
        end
    end

    save && save_notebook(notebook)
end

function update_nbpkg_core(
    notebook::Notebook; 
    level::Pkg.UpgradeLevel=Pkg.UPLEVEL_MAJOR, 
    on_terminal_output::Function=((args...) -> nothing),
    cleanup_iolistener::Ref{Function}=Ref{Function}(default_cleanup),
    precompile_session::ServerSession,
)
    if notebook.nbpkg_ctx !== nothing
        PkgCompat.mark_original!(notebook.nbpkg_ctx)

        old_packages = String.(keys(PkgCompat.project(notebook.nbpkg_ctx).dependencies))

        iolistener = let
            # we don't know which packages will be updated, so we send terminal output to all installed packages
            report_to = ["nbpkg_update", old_packages...]
            IOListener(callback=(s -> on_terminal_output(report_to, freeze_loading_spinners(s))))
        end
        cleanup_iolistener[] = () -> stoplistening(iolistener)
        
        if !isready(pkg_token)
            phasemessage(iolistener, "Waiting for other notebooks to finish Pkg operations")
            trigger(iolistener)
        end

        return withtoken(pkg_token) do
            withlogcapture(iolistener) do
                PkgCompat.refresh_registry_cache()
                PkgCompat.clear_stdlib_compat_entries!(notebook.nbpkg_ctx)

                if !notebook.nbpkg_ctx_instantiated
                    with_auto_fixes(notebook, iolistener) do
                        _resolve(notebook, iolistener)
                    end
                    _instantiate(notebook, iolistener)
                end

                with_io_setup(notebook, iolistener) do
                    phasemessage(iolistener, "Updating packages")
                    # We temporarily clear the "semver-compatible" [deps] entries, because it is difficult to update them after the update 🙈. TODO
                    PkgCompat.clear_auto_compat_entries!(notebook.nbpkg_ctx)
                    
                    try
                        ###
                        withenv("JULIA_PKG_PRECOMPILE_AUTO" => 0) do
                            Pkg.update(notebook.nbpkg_ctx; level=level)
                        end
                        ###
                    finally
                        PkgCompat.write_auto_compat_entries!(notebook.nbpkg_ctx)
                    end
                end


                PkgCompat.refresh_registry_cache()
                🐧 = !PkgCompat.is_original(notebook.nbpkg_ctx)
                should_instantiate_again = !notebook.nbpkg_ctx_instantiated || 🐧
                
                if should_instantiate_again
                    # Status.report_business!(pkg_status, :instantiate2) do
                    _instantiate(notebook, iolistener)
                    _precompile(precompile_session, notebook, iolistener)
                    # end
                end

                stoplistening(iolistener)

                (
                    did_something=🐧,
                    restart_recommended=🐧,
                    restart_required=🐧,
                )
            end
        end
    end
    (
        did_something=false,
        restart_recommended=false,
        restart_required=false,
    )
end


function update_nbpkg(session, notebook::Notebook; level::Pkg.UpgradeLevel=Pkg.UPLEVEL_MAJOR, backup::Bool=true, save::Bool=true)
    @assert will_run_pkg(notebook)

    bp = if backup && save
        writebackup(notebook)
    end
    cleanup_iolistener = Ref{Function}(_default_cleanup)

    try
		pkg_result = withtoken(notebook.executetoken) do
            original_outputs = deepcopy(notebook.nbpkg_terminal_outputs)
			function iocallback(pkgs, s)
				notebook.nbpkg_busy_packages = pkgs
				for p in pkgs
                    original = get(original_outputs, p, "")
					notebook.nbpkg_terminal_outputs[p] = original * "\n\n" * s
				end
                update_nbpkg_cache!(notebook)
				send_notebook_changes!(ClientRequest(; session, notebook))
			end
			update_nbpkg_core(
                notebook; 
                level, 
                on_terminal_output=iocallback,
                cleanup_iolistener,
                precompile_session=session,
            )
		end

		if pkg_result.did_something
			if pkg_result.restart_recommended
				notebook.nbpkg_restart_recommended_msg = "Yes, something changed during regular update_nbpkg."
				@debug "PlutoPkg: Notebook restart recommended" notebook.path notebook.nbpkg_restart_recommended_msg
			end
			if pkg_result.restart_required
				notebook.nbpkg_restart_required_msg = "Yes, something changed during regular update_nbpkg."
				@debug "PlutoPkg: Notebook restart REQUIRED" notebook.path notebook.nbpkg_restart_required_msg
			end
		else
            !isnothing(bp) && isfile(bp) && rm(bp)
        end
	finally
        cleanup_iolistener[]()
		notebook.nbpkg_busy_packages = String[]
        update_nbpkg_cache!(notebook)
		send_notebook_changes!(ClientRequest(; session, notebook))
		save && save_notebook(session, notebook)
	end
end

nbpkg_cache(ctx::Union{Nothing,PkgContext}) = ctx === nothing ? Dict{String,String}() : Dict{String,String}(
    x => string(PkgCompat.get_manifest_version(ctx, x)) for x in keys(PkgCompat.project(ctx).dependencies)
)

function update_nbpkg_cache!(notebook::Notebook)
    notebook.nbpkg_installed_versions_cache = nbpkg_cache(notebook.nbpkg_ctx)
    notebook
end

function is_nbpkg_equal(a::Union{Nothing,PkgContext}, b::Union{Nothing,PkgContext})::Bool
    if (a isa Nothing) != (b isa Nothing)
        the_other = something(a, b)
        
        ptoml_contents = PkgCompat.read_project_file(the_other)
        the_other_is_empty = isempty(strip(ptoml_contents))
        
        if the_other_is_empty
            # then both are essentially 'empty' environments, i.e. equal
            true
        else
            # they are different
            false
        end
    elseif a isa Nothing
        true
    else
        ptoml_contents_a = strip(PkgCompat.read_project_file(a))
        ptoml_contents_b = strip(PkgCompat.read_project_file(b))
        
        if ptoml_contents_a == ptoml_contents_b == ""
            true
        else
            mtoml_contents_a = strip(PkgCompat.read_project_file(a))
            mtoml_contents_b = strip(PkgCompat.read_project_file(b))
            
            (ptoml_contents_a == ptoml_contents_b) && (mtoml_contents_a == mtoml_contents_b)
        end
    end
end

with_io_setup(f::Function, notebook::Notebook, iolistener::Nothing) = f()

function with_io_setup(f::Function, notebook::Notebook, iolistener::IOListener)
    startlistening(iolistener)
    PkgCompat.withio(notebook.nbpkg_ctx, IOContext(
        iolistener.buffer, 
        :color => true, 
        :force_fancyprint => true, # https://github.com/JuliaLang/julia/pull/58887
        :sneaky_enable_tty => true, # fallback for the flag above
    )) do
        withinteractive(false) do
            f()
        end
    end
end


hide_outdated_manifest_logs(logger) = LoggingExtras.ActiveFilteredLogger(logger) do log
    !occursin(log.message, "has an old format that is being maintained")
end

withlogcapture(f::Function, iolistener::IOListener) = 
    Logging.with_logger(f, LoggingExtras.TeeLogger(
        Logging.current_logger(),
        Logging.ConsoleLogger(IOContext(iolistener.buffer, :color => true), Logging.Info)
    ) |> hide_outdated_manifest_logs)


const is_interactive_defined = isdefined(Base, :is_interactive) && !Base.isconst(Base, :is_interactive)
function withinteractive(f::Function, value::Bool)
    old_value = isinteractive()
    @static if is_interactive_defined
        Core.eval(Base, :(is_interactive = $value))
    end
    try
        f()
    finally
        @static if is_interactive_defined
            Core.eval(Base, :(is_interactive = $old_value))
        end
    end
end
