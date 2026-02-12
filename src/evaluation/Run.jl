import REPL: ends_with_semicolon
import .Configuration
import .Throttled
import ExpressionExplorer: is_joined_funcname
import UUIDs: UUID

"""
Run given cells and all the cells that depend on them, based on the topology information before and after the changes.
"""
function run_reactive!(
    session::ServerSession,
    notebook::Notebook,
    old_topology::NotebookTopology,
    new_topology::NotebookTopology,
    roots::Vector{Cell};
	save::Bool=true,
    deletion_hook::Function = WorkspaceManager.move_vars,
    user_requested_run::Bool = true,
    bond_value_pairs=zip(Symbol[],Any[]),
)::TopologicalOrder
    topological_order = withtoken(notebook.executetoken) do
        run_reactive_core!(
            session,
            notebook,
            old_topology,
            new_topology,
            roots;
			save,
            deletion_hook,
            user_requested_run,
            bond_value_pairs,
        )
    end
    try_event_call(session, NotebookExecutionDoneEvent(notebook, user_requested_run))
	return topological_order
end

"""
Run given cells and all the cells that depend on them, based on the topology information before and after the changes.

!!! warning
    You should probably not call this directly and use `run_reactive!` instead.
"""
function run_reactive_core!(
    session::ServerSession,
    notebook::Notebook,
    old_topology::NotebookTopology,
    new_topology::NotebookTopology,
    roots::Vector{Cell};
	save::Bool=true,
    deletion_hook::Function = WorkspaceManager.move_vars,
    user_requested_run::Bool = true,
    already_run::Vector{Cell} = Cell[],
    bond_value_pairs=zip(Symbol[],Any[]),
)::TopologicalOrder
    @assert !isready(notebook.executetoken) "run_reactive_core!() was called with a free notebook.executetoken."
    @assert will_run_code(notebook)
	
    old_workspace_name, _ = WorkspaceManager.bump_workspace_module((session, notebook))
	
	# A state sync will come soon from this function, so let's delay anything coming from the status_tree listener, see https://github.com/fonsp/Pluto.jl/issues/2978
	Throttled.force_throttle_without_run(notebook.status_tree.update_listener_ref[])
	
	run_status = Status.report_business_started!(notebook.status_tree, :run)
	Status.report_business_started!(run_status, :resolve_topology)
	cell_status = Status.report_business_planned!(run_status, :evaluate)
	
    if !PlutoDependencyExplorer.is_resolved(new_topology)
        unresolved_topology = new_topology
        new_topology = notebook.topology = resolve_topology(session, notebook, unresolved_topology, old_workspace_name; current_roots = setdiff(roots, already_run))

        # update cache and save notebook because the dependencies might have changed after expanding macros
        update_dependency_cache!(notebook)
    end
	
    # find (indirectly) skipped-as-script cells and update their status
    update_skipped_cells_dependency!(notebook, new_topology)

    removed_cells = setdiff(all_cells(old_topology), all_cells(new_topology))
    roots = vcat(roots, removed_cells)

    # by setting the reactive node and expression caches of deleted cells to "empty", we are essentially pretending that those cells still exist, but now have empty code. this makes our algorithm simpler.
    new_topology = PlutoDependencyExplorer.exclude_roots(new_topology, removed_cells)

    # find (directly and indirectly) deactivated cells and update their status
    indirectly_deactivated = collect(topological_order_cached(new_topology, collect(new_topology.disabled_cells); allow_multiple_defs=true, skip_at_partial_multiple_defs=true))

    for cell in indirectly_deactivated
        cell.running = false
        cell.queued = false
        cell.depends_on_disabled_cells = true
    end

    new_topology = PlutoDependencyExplorer.exclude_roots(new_topology, indirectly_deactivated)

    # save the old topological order - we'll delete variables assigned from its
    # and re-evalutate its cells unless the cells have already run previously in the reactive run
    old_order = topological_order_cached(old_topology, roots)

    old_runnable = setdiff(old_order.runnable, already_run)
    to_delete_vars = union!(Set{Symbol}(), defined_variables(old_topology, old_runnable)...)
    to_delete_funcs = union!(Set{Tuple{UUID,FunctionName}}(), defined_functions(old_topology, old_runnable)...)


    new_roots = setdiff(union(roots, keys(old_order.errable)), indirectly_deactivated)
    # get the new topological order
    new_order = topological_order_cached(new_topology, new_roots)
    new_runnable = setdiff(new_order.runnable, already_run)
    to_run = setdiff!(
        union(new_runnable, old_runnable),
        indirectly_deactivated,
        keys(new_order.errable)
    )::Vector{Cell} # TODO: think if old error cell order matters


    # change the bar on the sides of cells to "queued"
    for cell in to_run
        cell.queued = true
        cell.depends_on_disabled_cells = false
    end
	
    for (cell, error) in new_order.errable
        cell.running = false
        cell.queued = false
		cell.depends_on_disabled_cells = false
        relay_reactivity_error!(cell, error)
    end

	# Save the notebook. In most cases, this is the only time that we save the notebook, so any state changes that influence the file contents (like `depends_on_disabled_cells`) should be behind this point. (More saves might happen if a macro expansion or package using happens.)
	save && save_notebook(session, notebook)
	
    # Send intermediate updates to the clients at most 20 times / second during a reactive run. (The effective speed of a slider is still unbounded, because the last update is not throttled.)
    # flush_send_notebook_changes_throttled, 
    send_notebook_changes_throttled = Throttled.throttled(1.0 / 20; runtime_multiplier=2.0) do
		# We will do a state sync now, so that means that we can delay the status_tree state sync loop, see https://github.com/fonsp/Pluto.jl/issues/2978
		Throttled.force_throttle_without_run(notebook.status_tree.update_listener_ref[])
		# State sync:
        send_notebook_changes!(ClientRequest(; session, notebook))
    end
    send_notebook_changes_throttled()
	
	Status.report_business_finished!(run_status, :resolve_topology)
	Status.report_business_started!(cell_status)
	for i in eachindex(to_run)
		Status.report_business_planned!(cell_status, Symbol(i))
	end

    # delete new variables that will be defined by a cell unless this cell has already run in the current reactive run
    to_delete_vars = union!(to_delete_vars, defined_variables(new_topology, new_runnable)...)
    to_delete_funcs = union!(to_delete_funcs, defined_functions(new_topology, new_runnable)...)

    # delete new variables in case a cell errors (then the later cells show an UndefVarError)
    new_errable = keys(new_order.errable)
    to_delete_vars = union!(to_delete_vars, defined_variables(new_topology, new_errable)...)
    to_delete_funcs = union!(to_delete_funcs, defined_functions(new_topology, new_errable)...)
	
    cells_to_macro_invalidate = Set{UUID}(c.cell_id for c in cells_with_deleted_macros(old_topology, new_topology))
	cells_to_js_link_invalidate = Set{UUID}(c.cell_id for c in union!(Set{Cell}(), to_run, new_errable, indirectly_deactivated))

    module_imports_to_move = reduce(all_cells(new_topology); init=Set{Expr}()) do module_imports_to_move, c
        c ∈ to_run && return module_imports_to_move
        usings_imports = new_topology.codes[c].module_usings_imports
        for (using_, isglobal) in zip(usings_imports.usings, usings_imports.usings_isglobal)
            isglobal || continue
            push!(module_imports_to_move, using_)
        end
        module_imports_to_move
    end

    if will_run_code(notebook)
		to_delete_funcs_simple = Set{Tuple{UUID,Tuple{Vararg{Symbol}}}}((id, name.parts) for (id,name) in to_delete_funcs)
        deletion_hook((session, notebook), old_workspace_name, nothing, to_delete_vars, to_delete_funcs_simple, module_imports_to_move, cells_to_macro_invalidate, cells_to_js_link_invalidate; to_run) # `deletion_hook` defaults to `WorkspaceManager.move_vars`
    end

	foreach(v -> delete!(notebook.bonds, v), to_delete_vars)

    local any_interrupted = false
    for (i, cell) in enumerate(to_run)
		Status.report_business_started!(cell_status, Symbol(i))

        cell.queued = false
        cell.running = true
        # Important to not use empty! here because AppendonlyMarker requires a new array identity.
        # Eventually we could even make AppendonlyArray to enforce this but idk if it's worth it. yadiyadi.
        cell.logs = Vector{Dict{String,Any}}()
        send_notebook_changes_throttled()

        if (skip = any_interrupted || notebook.wants_to_interrupt || !will_run_code(notebook))
            relay_reactivity_error!(cell, InterruptException())
        else
            run = run_single!(
                (session, notebook), cell,
                new_topology.nodes[cell], new_topology.codes[cell];
                user_requested_run = (user_requested_run && cell ∈ roots),
                capture_stdout = session.options.evaluation.capture_stdout,
            )
            any_interrupted |= run.interrupted

            # Support one bond defining another when setting both simultaneously in PlutoSliderServer
            # https://github.com/fonsp/Pluto.jl/issues/1695

            # set the redefined bound variables to their original value from the request
            defs = notebook.topology.nodes[cell].definitions
            set_bond_value_pairs!(session, notebook, Iterators.filter(((sym,val),) -> sym ∈ defs, bond_value_pairs))
        end

        cell.running = false
		Status.report_business_finished!(cell_status, Symbol(i), !skip && !run.errored)

        defined_macros_in_cell = defined_macros(new_topology, cell) |> Set{Symbol}

        # Also set unresolved the downstream cells using the defined macros
        if !isempty(defined_macros_in_cell)
            new_topology = PlutoDependencyExplorer.set_unresolved(new_topology, PlutoDependencyExplorer.where_referenced(new_topology, defined_macros_in_cell))
        end

        implicit_usings = collect_implicit_usings(new_topology, cell)
        if !PlutoDependencyExplorer.is_resolved(new_topology) && can_help_resolve_cells(new_topology, cell)
            notebook.topology = new_new_topology = resolve_topology(session, notebook, new_topology, old_workspace_name)

            if !isempty(implicit_usings)
                new_soft_definitions = WorkspaceManager.collect_soft_definitions((session, notebook), implicit_usings)
                notebook.topology = new_new_topology = with_new_soft_definitions(new_new_topology, cell, new_soft_definitions)
            end

            # update cache and save notebook because the dependencies might have changed after expanding macros
            update_dependency_cache!(notebook)
            save && save_notebook(session, notebook)

            return run_reactive_core!(session, notebook, new_topology, new_new_topology, to_run; save, deletion_hook, user_requested_run, already_run = to_run[1:i])
        elseif !isempty(implicit_usings)
            new_soft_definitions = WorkspaceManager.collect_soft_definitions((session, notebook), implicit_usings)
            notebook.topology = new_new_topology = with_new_soft_definitions(new_topology, cell, new_soft_definitions)

            # update cache and save notebook because the dependencies might have changed after expanding macros
            update_dependency_cache!(notebook)
            save && save_notebook(session, notebook)

            return run_reactive_core!(session, notebook, new_topology, new_new_topology, to_run; save, deletion_hook, user_requested_run, already_run = to_run[1:i])
        end
    end

    notebook.wants_to_interrupt = false
	Status.report_business_finished!(run_status)
    flush(send_notebook_changes_throttled)
    return new_order
end

"""
```julia
set_bond_value_pairs!(session::ServerSession, notebook::Notebook, bond_value_pairs::Vector{Tuple{Symbol, Any}})
```
Given a list of tuples of the form `(bound variable name, (untransformed) value)`, assign each (transformed) value to the corresponding global bound variable in the notebook workspace.
`bond_value_pairs` can also be an iterator.
"""
function set_bond_value_pairs!(session::ServerSession, notebook::Notebook, bond_value_pairs)
	for (bound_sym, new_value) in bond_value_pairs
		WorkspaceManager.eval_in_workspace((session, notebook), :($(bound_sym) = Main.PlutoRunner.transform_bond_value($(QuoteNode(bound_sym)), $(new_value))))
	end
end

run_reactive_async!(session::ServerSession, notebook::Notebook, to_run::Vector{Cell}; kwargs...) = run_reactive_async!(session, notebook, notebook.topology, notebook.topology, to_run; kwargs...)

function run_reactive_async!(session::ServerSession, notebook::Notebook, old::NotebookTopology, new::NotebookTopology, to_run::Vector{Cell}; run_async::Bool=true, kwargs...)::Union{Task,TopologicalOrder}
	maybe_async(run_async) do 
		run_reactive!(session, notebook, old, new, to_run; kwargs...)
	end
end

function maybe_async(f::Function, async::Bool)
	run_task = @asynclog f()
	if async
		run_task
	else
		fetch(run_task)
	end
end

"Run a single cell non-reactively, set its output, return run information."
function run_single!(
	session_notebook::Union{Tuple{ServerSession,Notebook},WorkspaceManager.Workspace}, 
	cell::Cell, 
	reactive_node::ReactiveNode, 
	expr_cache::ExprAnalysisCache; 
	user_requested_run::Bool=true,
	capture_stdout::Bool=true,
)
	run = WorkspaceManager.eval_format_fetch_in_workspace(
		session_notebook,
		expr_cache.parsedcode,
		cell.cell_id;
		
		ends_with_semicolon =
			ends_with_semicolon(cell.code),
		function_wrapped_info =
			expr_cache.function_wrapped ? (filter(!is_joined_funcname, reactive_node.references), reactive_node.definitions) : nothing,
		forced_expr_id =
			expr_cache.forced_expr_id,
		known_published_objects =
			collect(keys(cell.published_objects)),
		user_requested_run,
		capture_stdout,
	)
	set_output!(cell, run, expr_cache; persist_js_state=!user_requested_run)
	if session_notebook isa Tuple && run.process_exited
		session_notebook[2].process_status = ProcessStatus.no_process
	end
	return run
end

function set_output!(cell::Cell, run, expr_cache::ExprAnalysisCache; persist_js_state::Bool=false)
	cell.output = CellOutput(
		body=run.output_formatted[1],
		mime=run.output_formatted[2],
		rootassignee=if ends_with_semicolon(expr_cache.code)
			nothing
		else
			try 
				ExpressionExplorer.get_rootassignee(expr_cache.parsedcode)
			catch _
				# @warn "Error in get_rootassignee" expr=expr_cache.parsedcode
				nothing
			end
		end,
		last_run_timestamp=time(),
		persist_js_state=persist_js_state,
		has_pluto_hook_features=run.has_pluto_hook_features,
	)
	cell.published_objects = let
		old_published = cell.published_objects
		new_published = run.published_objects
		for (k,v) in old_published
			if haskey(new_published, k)
				new_published[k] = v
			end
		end
		new_published
	end
	
	cell.runtime = run.runtime
	cell.errored = run.errored
	cell.running = cell.queued = false
end

function clear_output!(cell::Cell)
	cell.output = CellOutput()
	cell.published_objects = Dict{String,Any}()
	
	cell.runtime = nothing
	cell.errored = false
	cell.running = cell.queued = false
end


"Send `error` to the frontend without backtrace. Runtime errors are handled by `WorkspaceManager.eval_format_fetch_in_workspace` - this function is for Reactivity errors."
function relay_reactivity_error!(cell::Cell, error::Exception)
	body, mime = PlutoRunner.format_output(CapturedException(error, []))
	cell.output = CellOutput(
		body=body,
		mime=mime,
		rootassignee=nothing,
		last_run_timestamp=time(),
		persist_js_state=false,
	)
	cell.published_objects = Dict{String,Any}()
	cell.runtime = nothing
	cell.errored = true
end

will_run_code(notebook::Notebook) = notebook.process_status ∈ (ProcessStatus.ready, ProcessStatus.starting)
will_run_pkg(notebook::Notebook) = notebook.process_status !== ProcessStatus.waiting_for_permission


"Do all the things!"
function update_save_run!(
	session::ServerSession, 
	notebook::Notebook, 
	cells::Vector{Cell}; 
	save::Bool=true, 
	run_async::Bool=false, 
	prerender_text::Bool=false, 
	clear_not_prerenderable_cells::Bool=false, 
	auto_solve_multiple_defs::Bool=false,
	on_auto_solve_multiple_defs::Function=identity,
	kwargs...
)
	old = notebook.topology
	new = notebook.topology = updated_topology(old, notebook, cells) # macros are not yet resolved
	
	# _assume `auto_solve_multiple_defs == false` if you want to skip some details_
	if auto_solve_multiple_defs
		to_disable_dict = cells_to_disable_to_resolve_multiple_defs(old, new, cells)
		
		if !isempty(to_disable_dict)
			to_disable = keys(to_disable_dict)
			@debug "Using augmented topology" cell_id.(to_disable)
			
			foreach(c -> set_disabled(c, true), to_disable)
			
			cells = union(cells, to_disable)
			# need to update the topology because the topology also keeps track of disabled cells
			new = notebook.topology = updated_topology(new, notebook, to_disable)
		end
		
		on_auto_solve_multiple_defs(to_disable_dict)
	end

	update_dependency_cache!(notebook)
	save && save_notebook(session, notebook)

	# _assume `prerender_text == false` if you want to skip some details_
	to_run_online = cells
	if prerender_text
		# this code block will run cells that only contain text offline, i.e. on the server process, before doing anything else
		# this makes the notebook load a lot faster - the front-end does not have to wait for each output, and perform costly reflows whenever one updates
		# "A Workspace on the main process, used to prerender markdown before starting a notebook process for speedy UI."
		offline_session = ServerSession()
		offline_workspace = WorkspaceManager.make_workspace(
			(
				offline_session,
				notebook,
			),
			is_offline_renderer=true,
		)

		to_run_offline = filter(c -> !c.running && is_just_text(new, c), cells)
		for cell in to_run_offline
			run_single!(offline_workspace, cell, new.nodes[cell], new.codes[cell])
		end

		to_run_online = setdiff(cells, to_run_offline)
		
		clear_not_prerenderable_cells && foreach(clear_output!, to_run_online)
		
		finalize(offline_session)
		send_notebook_changes!(ClientRequest(; session, notebook))
	end

	# this setting is not officially supported (default is `true`), so you can skip this block when reading the code
	if !session.options.evaluation.run_notebook_on_load && prerender_text
		# these cells do something like settings up an environment, we should always run them
		setup_cells = filter(notebook.cells) do c
			PlutoDependencyExplorer.cell_precedence_heuristic(notebook.topology, c) < DEFAULT_PRECEDENCE_HEURISTIC
		end
		
		# for the remaining cells, clear their topology info so that they won't run as dependencies
		old = notebook.topology
		to_remove = setdiff(to_run_online, setup_cells)
		notebook.topology = NotebookTopology(
			nodes=PlutoDependencyExplorer.setdiffkeys(old.nodes, to_remove),
			codes=PlutoDependencyExplorer.setdiffkeys(old.codes, to_remove),
			unresolved_cells=setdiff(old.unresolved_cells, to_remove),
			cell_order=old.cell_order,
			disabled_cells=setdiff(old.disabled_cells, to_remove),
		)
		
		# and don't run them
		to_run_online = to_run_online ∩ setup_cells
	end

	maybe_async(run_async) do
        topological_order = withtoken(notebook.executetoken) do
			run_code = !(
				isempty(to_run_online) && 
				session.options.evaluation.lazy_workspace_creation
			) && will_run_code(notebook)
			
			if run_code
				# this will trigger the notebook process to start. @async makes it run in the background, so that sync_nbpkg (below) can start running in parallel.
				# Some notes:
				# - @async is enough, we don't need multithreading because the notebook runs in a separate process.
				# - sync_nbpkg manages the notebook package environment using Pkg on this server process. This means that sync_nbpkg does not need the notebook process at all, and it can run in parallel, before it has even started.
				@async WorkspaceManager.get_workspace((session, notebook))
			end
			
			if will_run_pkg(notebook)
				# downloading and precompiling packages from the General registry is also arbitrary code execution
				sync_nbpkg(session, notebook, old, new; 
					save=(save && !session.options.server.disable_writing_notebook_files), 
					take_token=false
				)
			end
			
            if run_code
                # not async because that would be double async
                run_reactive_core!(session, notebook, old, new, to_run_online; save, kwargs...)
                # run_reactive_async!(session, notebook, old, new, to_run_online; deletion_hook=deletion_hook, run_async=false, kwargs...)
            end
        end
        try_event_call(
            session,
            NotebookExecutionDoneEvent(notebook, get(kwargs, :user_requested_run, true))
        )
		topological_order
    end
end

update_save_run!(session::ServerSession, notebook::Notebook, cell::Cell; kwargs...) = update_save_run!(session, notebook, [cell]; kwargs...)
update_run!(args...; kwargs...) = update_save_run!(args...; save=false, kwargs...)


function cells_to_disable_to_resolve_multiple_defs(old::NotebookTopology, new::NotebookTopology, cells::Vector{Cell})::Dict{Cell,Any}
	# keys are cells to disable
	# values are the reason why
	to_disable_and_why = Dict{Cell,Any}()
	
	for cell in cells
		new_node = new.nodes[cell]
		
		fellow_assigners_old = filter!(c -> !PlutoDependencyExplorer.is_disabled(old, c), PlutoDependencyExplorer.where_assigned(old, new_node))
		fellow_assigners_new = filter!(c -> !PlutoDependencyExplorer.is_disabled(new, c), PlutoDependencyExplorer.where_assigned(new, new_node))
		
		if length(fellow_assigners_new) > length(fellow_assigners_old)
			other_definers = setdiff(fellow_assigners_new, (cell,))
			# we want cell to be the only element of cells that defines this varialbe, i.e. all other definers must have been created previously
			if disjoint(cells, other_definers)
				# all fellow cells (including the current cell) should meet some criteria:
				all_fellows_are_simple_enough = all(fellow_assigners_new) do c
					node = new.nodes[c]
					
					# all must be true:
					return (
						length(node.definitions) == 1 && # for more than one defined variable, we might confuse the user, or disable more things than we want to.
						disjoint(node.references, node.definitions) && # avoid self-reference like `x = x + 1`
						isempty(node.funcdefs_without_signatures) &&
						node.macrocalls ⊆ (Symbol("@bind"),) # allow no macros (except for `@bind`)
					)
				end
				
				if all_fellows_are_simple_enough 
					for c in other_definers
						# if the cell is already disabled (indirectly), then we don't need to disable it. probably.
						if !c.depends_on_disabled_cells
							to_disable_and_why[c] = (cell_id(cell), only(new.nodes[c].definitions))
						end
					end
				end
			end
		end
	end
	
	to_disable_and_why
end



function notebook_differences(from::Notebook, to::Notebook)
	from_cells = from.cells_dict
	to_cells = to.cells_dict

	(
		# it's like D3 joins: https://observablehq.com/@d3/learn-d3-joins#cell-528
		added = setdiff(keys(to_cells), keys(from_cells)),
		removed = setdiff(keys(from_cells), keys(to_cells)),
		changed = let
			remained = keys(from_cells) ∩ keys(to_cells)
			filter(remained) do id
				from_cells[id].code != to_cells[id].code || from_cells[id].metadata != to_cells[id].metadata
			end
		end,
		
		folded_changed = any(from_cells[id].code_folded != to_cells[id].code_folded for id in keys(from_cells) if haskey(to_cells, id)),
		order_changed = from.cell_order != to.cell_order,
		nbpkg_changed = !is_nbpkg_equal(from.nbpkg_ctx, to.nbpkg_ctx),
	)
end

notebook_differences(from_filename::String, to_filename::String) = notebook_differences(load_notebook_nobackup(from_filename), load_notebook_nobackup(to_filename))

"""
Read the notebook file at `notebook.path`, and compare the read result with the notebook's current state. Any changes will be applied to the running notebook, i.e. code changes are run, removed cells are removed, etc.

Returns `false` if the file could not be parsed, `true` otherwise.
"""
function update_from_file(session::ServerSession, notebook::Notebook; kwargs...)::Bool
	include_nbpg = !session.options.server.auto_reload_from_file_ignore_pkg
	
	just_loaded = try
		load_notebook_nobackup(notebook.path)
	catch e
		@error "Skipping hot reload because loading the file went wrong" exception=(e,catch_backtrace())
		return false
	end::Notebook
	
	d = notebook_differences(notebook, just_loaded)
	
	added = d.added
	removed = d.removed
	changed = d.changed
	
	# @show added removed changed
	
	cells_changed = !(isempty(added) && isempty(removed) && isempty(changed))
	folded_changed = d.folded_changed
	order_changed = d.order_changed
	nbpkg_changed = d.nbpkg_changed
		
	something_changed = cells_changed || folded_changed || order_changed || (include_nbpg && nbpkg_changed)

	if something_changed
		@info "Reloading notebook from file and applying changes!"
		notebook.last_hot_reload_time = time()
	end
	
	for c in added
		notebook.cells_dict[c] = just_loaded.cells_dict[c]
	end
	for c in removed
		delete!(notebook.cells_dict, c)
	end
	for c in changed
		notebook.cells_dict[c].code = just_loaded.cells_dict[c].code
		notebook.cells_dict[c].metadata = just_loaded.cells_dict[c].metadata
	end

	for c in keys(notebook.cells_dict) ∩ keys(just_loaded.cells_dict)
		notebook.cells_dict[c].code_folded = just_loaded.cells_dict[c].code_folded
	end

	notebook.cell_order = just_loaded.cell_order
	notebook.metadata = just_loaded.metadata

	if include_nbpg && nbpkg_changed
		@info "nbpkgs not equal" (notebook.nbpkg_ctx isa Nothing) (just_loaded.nbpkg_ctx isa Nothing)
		
		if (notebook.nbpkg_ctx isa Nothing) != (just_loaded.nbpkg_ctx isa Nothing)
			@info "nbpkg status changed, overriding..."
			notebook.nbpkg_ctx = just_loaded.nbpkg_ctx
			notebook.nbpkg_install_time_ns = just_loaded.nbpkg_install_time_ns
		else
			@info "Old new project" PkgCompat.read_project_file(notebook) PkgCompat.read_project_file(just_loaded)
			@info "Old new manifest" PkgCompat.read_manifest_file(notebook) PkgCompat.read_manifest_file(just_loaded)
			
			write(PkgCompat.project_file(notebook), PkgCompat.read_project_file(just_loaded))
			write(PkgCompat.manifest_file(notebook), PkgCompat.read_manifest_file(just_loaded))
		end
		notebook.nbpkg_restart_required_msg = "Yes, because the file was changed externally and the embedded Pkg changed."
	end

	if something_changed
		update_save_run!(session, notebook, Cell[notebook.cells_dict[c] for c in union(added, changed)]; kwargs...) # this will also update nbpkg if needed
	end

	return true
end

function update_skipped_cells_dependency!(notebook::Notebook, topology::NotebookTopology=notebook.topology)
    skipped_cells = filter(is_skipped_as_script, notebook.cells)
    indirectly_skipped = collect(topological_order_cached(topology, skipped_cells))
    for cell in notebook.cells
        cell.depends_on_skipped_cells = false
    end
    for cell in indirectly_skipped
        cell.depends_on_skipped_cells = true
    end
end

function update_disabled_cells_dependency!(notebook::Notebook, topology::NotebookTopology=notebook.topology)
    disabled_cells = filter(is_disabled, notebook.cells)
    indirectly_disabled = collect(topological_order_cached(topology, disabled_cells))
    for cell in notebook.cells
        cell.depends_on_disabled_cells = false
    end
    for cell in indirectly_disabled
        cell.depends_on_disabled_cells = true
    end
end


import LRUCache

const _cache_for_topological_order = LRUCache.LRU{UInt, TopologicalOrder{Cell}}(; maxsize = 10)

function topological_order_cached(topology::NotebookTopology, roots::AbstractVector{Cell}; kwargs...)
	h = hash((
		# the `topology` object is designed to be `===` the same if the cell inputs dont change. So we should use objectid here
		objectid(topology), 
		# we don't just hash `roots` directly because thats quite a lot of work
		objectid.(roots),
		# we hash the kwargs
		kwargs))
	get!(_cache_for_topological_order, h) do
		topological_order(topology, roots; kwargs...)
	end
end
