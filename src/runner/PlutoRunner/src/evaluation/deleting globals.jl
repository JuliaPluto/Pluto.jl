


# This function checks whether the symbol provided to it represents a name of a memoized_cache variable from Memoize.jl, see https://github.com/fonsp/Pluto.jl/issues/2305 for more details
is_memoized_cache(s::Symbol) = startswith(string(s), "##") && endswith(string(s), "_memoized_cache")

function do_reimports(workspace_name, module_imports_to_move::Set{Expr})
    for expr in module_imports_to_move
        try
            Core.eval(workspace_name, expr)
        catch e end # TODO catch specificallly
    end
end

"""
Move some of the globals over from one workspace to another. This is how Pluto "deletes" globals - it doesn't, it just executes your new code in a new module where those globals are not defined.

Notebook code does run in `Main` - it runs in workspace modules. Every time that you run cells, a new module is created, called `Main.workspace123` with `123` an increasing number.

The trick boils down to two things:
1. When we create a new workspace module, we move over some of the global from the old workspace. (But not the ones that we want to 'delete'!)
2. If a function used to be defined, but now we want to delete it, then we go through the method table of that function and snoop out all methods that were defined by us, and not by another package. This is how we reverse extending external functions. For example, if you run a cell with `Base.sqrt(s::String) = "the square root of" * s`, and then delete that cell, then you can still call `sqrt(1)` but `sqrt("one")` will err. Cool right!
"""
function move_vars(
    old_workspace_name::Symbol,
    new_workspace_name::Symbol,
    vars_to_delete::Set{Symbol},
    methods_to_delete::Set{Tuple{UUID,Tuple{Vararg{Symbol}}}},
    module_imports_to_move::Set{Expr},
    cells_to_macro_invalidate::Set{UUID},
    cells_to_js_link_invalidate::Set{UUID},
    keep_registered::Set{Symbol},
)
    old_workspace = getfield(Main, old_workspace_name)
    new_workspace = getfield(Main, new_workspace_name)

    for cell_id in cells_to_macro_invalidate
        delete!(cell_expanded_exprs, cell_id)
    end
    foreach(unregister_js_link, cells_to_js_link_invalidate)

    # TODO: delete
    Core.eval(new_workspace, :(import ..($(old_workspace_name))))

    old_names = names(old_workspace, all=true, imported=true)

    funcs_with_no_methods_left = filter(methods_to_delete) do f
        !try_delete_toplevel_methods(old_workspace, f)
    end
    name_symbols_of_funcs_with_no_methods_left = last.(last.(funcs_with_no_methods_left))
    for symbol in old_names
        if (symbol ∈ vars_to_delete) || (symbol ∈ name_symbols_of_funcs_with_no_methods_left)
            # var will be redefined - unreference the value so that GC can snoop it

            if haskey(registered_bond_elements, symbol) && symbol ∉ keep_registered
                delete!(registered_bond_elements, symbol)
            end

            # free memory for other variables
            # & delete methods created in the old module:
            # for example, the old module might extend an imported function:
            # `import Base: show; show(io::IO, x::Flower) = print(io, "🌷")`
            # when you delete/change this cell, you want this extension to disappear.
            if isdefined(old_workspace, symbol)
                # try_delete_toplevel_methods(old_workspace, symbol)

                try
                    # We are clearing this variable from the notebook, so we need to find it's root
                    # If its root is "controlled" by Pluto's workspace system (and is not a package module for example),
                    # we are just clearing out the definition in the old_module, besides giving an error
                    # (so that's what that `catch; end` is for)
                    # will not actually free it from Julia, the older module will still have a reference.
                    module_to_remove_from = which(old_workspace, symbol)
                    if is_pluto_controlled(module_to_remove_from) && !isconst(module_to_remove_from, symbol)
                        Core.eval(module_to_remove_from, :($(symbol) = nothing))
                    end
                catch; end # sometimes impossible, eg. when $symbol was constant
            end
        else
            # var will not be redefined in the new workspace, move it over
            if !(symbol == :eval || symbol == :include || (string(symbol)[1] == '#' && !is_memoized_cache(symbol)) || startswith(string(symbol), "workspace#"))
                try
                    getfield(old_workspace, symbol)

                    # Expose the variable in the scope of `new_workspace`
                    Core.eval(new_workspace, :(import ..($(old_workspace_name)).$(symbol)))
                catch ex
                    if !(ex isa UndefVarError)
                        @warn "Failed to move variable $(symbol) to new workspace:"
                        showerror(original_stderr[], ex, stacktrace(catch_backtrace()))
                    end
                end
            end
        end
    end

    do_reimports(new_workspace, module_imports_to_move)
    revise_if_possible()
end




"Return whether the `method` was defined inside this notebook, and not in external code."
isfromcell(method::Method, cell_id::UUID) = endswith(String(method.file), string(cell_id))

"""
    delete_method_doc(m::Method)

Tries to delete the documentation for this method, this is used when methods are removed.
"""
function delete_method_doc(m::Method)
    binding = Docs.Binding(m.module, m.name)
    meta = Docs.meta(m.module)
    if haskey(meta, binding)
        method_sig = Tuple{m.sig.parameters[2:end]...}
        multidoc = meta[binding]
        filter!(multidoc.order) do msig
            if method_sig == msig
                pop!(multidoc.docs, msig)
                false
            else
                true
            end
        end
    end
end


"""
Delete all methods of `f` that were defined in this notebook, and leave the ones defined in other packages, base, etc. ✂

Return whether the function has any methods left after deletion.
"""
function delete_toplevel_methods(f::Function, cell_id::UUID)::Bool
    # we can delete methods of functions!
    # instead of deleting all methods, we only delete methods that were defined in this notebook. This is necessary when the notebook code extends a function from remote code
    
    deleted_sigs = Set{Type}()
    
    function handle_method(method)
        if isfromcell(method, cell_id) && !is_method_deleted(method)
            Base.delete_method(method)
            delete_method_doc(method)
            push!(deleted_sigs, method.sig)
        end
    end
    
    if VERSION < v"1.12.0-0"
        methods_table = typeof(f).name.mt
        Base.visit(handle_method, methods_table) # iterates through all methods of `f`, including overridden ones            
    else
        foreach(handle_method, methods(f))
    end
    
    if VERSION < v"1.12.0-0"
        # not necessary in Julia after https://github.com/JuliaLang/julia/pull/53415 💛
            
        # if `f` is an extension to an external function, and we defined a method that overrides a method, for example,
        # we define `Base.isodd(n::Integer) = rand(Bool)`, which overrides the existing method `Base.isodd(n::Integer)`
        # calling `Base.delete_method` on this method won't bring back the old method, because our new method still exists in the method table, and it has a world age which is newer than the original. (our method has a deleted_world value set, which disables it)
        #
        # To solve this, we iterate again, and _re-enable any methods that were hidden in this way_, by adding them again to the method table with an even newer `primary_world`.
        if !isempty(deleted_sigs)
            to_insert = Method[]
            Base.visit(methods_table) do method
                if !isfromcell(method, cell_id) && method.sig ∈ deleted_sigs
                    push!(to_insert, method)
                end
            end
            # separate loop to avoid visiting the recently added method
            for method in Iterators.reverse(to_insert)
                if VERSION >= v"1.11.0-0"
                    @atomic method.primary_world = one(typeof(alive_world_val)) # `1` will tell Julia to increment the world counter and set it as this function's world
                    @atomic method.deleted_world = alive_world_val # set the `deleted_world` property back to the 'alive' value (for Julia v1.6 and up)
                else
                    method.primary_world = one(typeof(alive_world_val))
                    method.deleted_world = alive_world_val
                end
                ccall(:jl_method_table_insert, Cvoid, (Any, Any, Ptr{Cvoid}), methods_table, method, C_NULL) # i dont like doing this either!
            end
        end
    end
    return !isempty(methods(f).ms)
end

# function try_delete_toplevel_methods(workspace::Module, name::Symbol)
#     try_delete_toplevel_methods(workspace, [name])
# end

function try_delete_toplevel_methods(workspace::Module, (cell_id, name_parts)::Tuple{UUID,Tuple{Vararg{Symbol}}})::Bool
    try
        val = workspace
        for name in name_parts
            val = getfield(val, name)
        end
        try
            (val isa Function) && delete_toplevel_methods(val, cell_id)
        catch ex
            @warn "Failed to delete methods for $(name_parts)"
            showerror(original_stderr[], ex, stacktrace(catch_backtrace()))
            false
        end
    catch
        false
    end
end

const alive_world_val = typemax(UInt) # This is true at least for julia 1.10 and 1.11, and it's not applicable for julia 1.12 and later. See issue https://github.com/fonsp/Pluto.jl/issues/3259 for more details. # UInt and not UInt64 because of https://github.com/JuliaLang/julia/pull/58291/files#diff-882927c6e612596e22406ae0d06adcee88a9ec05e8b61ad81b48942e2cb266e9 and https://github.com/JuliaLang/julia/blob/422d05d1f8c185ad636deb0ab181aa41e3d424ea/src/jltypes.c#L3237


# Check if a method has already been deleted/disabled
is_method_deleted(method::Method) = @static if VERSION < v"1.12.0-beta4"
    method.deleted_world !== alive_world_val
else
    # The dispatch status is set to 0 when a method is deleted. See the file `src/gc.f` changes in PR https://github.com/JuliaLang/julia/pull/58291 for more details.
    method.dispatch_status == 0
end


const revise_pkg_id = Base.PkgId(UUID("295af30f-e4ad-537b-8983-00126c2a3abe"), "Revise")
const revise_integration_broken = Ref(false)

# Revise.jl support
function revise_if_possible()
    revise_integration_broken[] && return
    if haskey(Base.loaded_modules, revise_pkg_id)
        reviseee = Base.loaded_modules[revise_pkg_id]
    
        try
            if !isempty(reviseee.revision_queue) # to avoid the sleep(0.01) in revise()
                reviseee.revise()
            end
        catch ex
            @warn "Failed to revise" exception=(ex, catch_backtrace()) pkgversion(reviseee)
            revise_integration_broken[] = true
        end
    end
end

