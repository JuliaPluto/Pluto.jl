import Logging

struct Computer
    f::Function
    expr_id::ObjectID
    input_globals::Vector{Symbol}
    output_globals::Vector{Symbol}
end

expr_hash(e::Expr) = objectid(e.head) + mapreduce(p -> objectid((p[1], expr_hash(p[2]))), +, enumerate(e.args); init=zero(ObjectID))
expr_hash(x) = objectid(x)

const computers = Dict{UUID,Computer}()
const computer_workspace = Main

const cells_with_hook_functionality_active = Set{UUID}()

"Registers a new computer for the cell, cleaning up the old one if there is one."
function register_computer(expr::Expr, key::ObjectID, cell_id::UUID, input_globals::Vector{Symbol}, output_globals::Vector{Symbol})
    @gensym result
    e = Expr(:function, Expr(:call, gensym(:function_wrapped_cell), input_globals...), Expr(:block,
        Expr(:(=), result, timed_expr(expr)),
        Expr(:tuple,
            result,
            Expr(:tuple, map(x -> :(@isdefined($(x)) ? $(x) : $(OutputNotDefined())), output_globals)...)
        )
    ))

    f = Core.eval(computer_workspace, e)

    if haskey(computers, cell_id)
        delete_computer!(computers, cell_id)
    end

    computers[cell_id] = Computer(f, key, input_globals, output_globals)
end

function delete_computer!(computers::Dict{UUID,Computer}, cell_id::UUID)
    computer = pop!(computers, cell_id)
    UseEffectCleanups.trigger_cleanup(cell_id)
    # Make the computer function uncallable
    if VERSION < v"1.12.0-0"
        Base.visit(Base.delete_method, methods(computer.f).mt)
    else
        foreach(Base.delete_method, methods(computer.f))
    end
end

parse_cell_id(filename::Symbol) = filename |> string |> parse_cell_id
parse_cell_id(filename::AbstractString) =
    match(r"#==#(.*)", filename).captures |> only |> UUID

module UseEffectCleanups
    import UUIDs: UUID

    const cell_cleanup_functions = Dict{UUID,Set{Function}}()

    function register_cleanup(f::Function, cell_id::UUID)
        cleanup_functions = get!(cell_cleanup_functions, cell_id, Set{Function}())
        push!(cleanup_functions, f)
        nothing
    end

    function trigger_cleanup(cell_id::UUID)
        for cleanup_func in get!(cell_cleanup_functions, cell_id, Set{Function}())
            try
                cleanup_func()
            catch error
                @warn "Cleanup function gave an error" cell_id error stacktrace=stacktrace(catch_backtrace())
            end
        end
        delete!(cell_cleanup_functions, cell_id)
    end
end

quote_if_needed(x) = x
quote_if_needed(x::Union{Expr, Symbol, QuoteNode, LineNumberNode}) = QuoteNode(x)

struct OutputNotDefined end

function compute(m::Module, computer::Computer)
    # 1. get the referenced global variables
    # this might error if the global does not exist, which is exactly what we want
    input_global_values = Vector{Any}(undef, length(computer.input_globals))
    for (i, s) in enumerate(computer.input_globals)
        input_global_values[i] = getfield(m, s)
    end

    # 2. run the function
    out = Base.invokelatest(computer.f, input_global_values...)
    result, output_global_values = out

    for (name, val) in zip(computer.output_globals, output_global_values)
        # Core.eval(m, Expr(:(=), name, quote_if_needed(val)))
        Core.eval(m, quote
            if $(quote_if_needed(val)) !== $(OutputNotDefined())
                $(name) = $(quote_if_needed(val))
            end
        end)
    end

    result
end

"Wrap `expr` inside a timing block."
function timed_expr(expr::Expr)::Expr
    # @assert ExpressionExplorer.is_toplevel_expr(expr)

    @gensym result
    @gensym elapsed_ns
    # we don't use `quote ... end` here to avoid the LineNumberNodes that it adds (these would taint the stack trace).
    Expr(:block,
        :(local $elapsed_ns = time_ns()),
        :(local $result = $expr),
        :($elapsed_ns = time_ns() - $elapsed_ns),
        :(($result, $elapsed_ns)),
    )
end

"""
Run the expression or function inside a try ... catch block, and verify its "return proof".
"""
function run_inside_trycatch(m::Module, f::Union{Expr,Function})::Tuple{Any,Union{UInt64,Nothing}}
    return try
        if f isa Expr
            # We eval `f` in the global scope of the workspace module:
            Core.eval(m, f)
        else
            # f is a function
            f()
        end
    catch ex
        bt = catch_backtrace()
        (CapturedException(ex, bt), nothing)
    end
end

add_runtimes(::Nothing, ::UInt64) = nothing
add_runtimes(a::UInt64, b::UInt64) = a+b

contains_macrocall(expr::Expr) = if expr.head == :macrocall
    if VERSION >= v"1.12.0-aaa" && length(expr.args) >= 1 && expr.args[1] == :(Base.var"@__doc__")
        # special case to support https://github.com/JuliaLang/julia/pull/53515
        false
    else
        true
    end
elseif expr.head == :module
    # Modules don't get expanded, sadly, so we don't touch it
    false
else
    any(arg -> contains_macrocall(arg), expr.args)
end
contains_macrocall(other) = false


"""
Run the given expression in the current workspace module. If the third argument is `nothing`, then the expression will be `Core.eval`ed. The result and runtime are stored inside [`cell_results`](@ref) and [`cell_runtimes`](@ref).

If the third argument is a `Tuple{Set{Symbol}, Set{Symbol}}` containing the referenced and assigned variables of the expression (computed by the ExpressionExplorer), then the expression will be **wrapped inside a function**, with the references as inputs, and the assignments as outputs. Instead of running the expression directly, Pluto will call this function, with the right globals as inputs.

This function is memoized: running the same expression a second time will simply call the same generated function again. This is much faster than evaluating the expression, because the function only needs to be Julia-compiled once. See https://github.com/fonsp/Pluto.jl/pull/720
"""
function run_expression(
        m::Module,
        expr::Any,
        notebook_id::UUID,
        cell_id::UUID,
        @nospecialize(function_wrapped_info::Union{Nothing,Tuple{Set{Symbol},Set{Symbol}}}=nothing),
        @nospecialize(forced_expr_id::Union{ObjectID,Nothing}=nothing);
        user_requested_run::Bool=true,
        capture_stdout::Bool=true,
    )
    if user_requested_run
        # TODO Time elapsed? Possibly relays errors in cleanup function?
        UseEffectCleanups.trigger_cleanup(cell_id)

        # TODO Could also put explicit `try_macroexpand` here, to make clear that user_requested_run => fresh macro identity
    end

    old_currently_running_cell_id = currently_running_cell_id[]
    currently_running_cell_id[] = cell_id

    logger = get_cell_logger(notebook_id, cell_id)

    # reset published objects
    cell_published_objects[cell_id] = Dict{String,Any}()

    # reset registered bonds
    cell_registered_bond_names[cell_id] = Set{Symbol}()

    # reset JS links
    unregister_js_link(cell_id)

    # If the cell contains macro calls, we want those macro calls to preserve their identity,
    # so we macroexpand this earlier (during expression explorer stuff), and then we find it here.
    # NOTE Turns out sometimes there is no macroexpanded version even though the expression contains macro calls...
    # .... So I macroexpand when there is no cached version just to be sure 🤷‍♀️
    # NOTE Errors during try_macroexpand will cause no expanded version to be stored.
    # .... This is fine, because it allows us to try again here and throw the error...
    # .... But ideally we wouldn't re-macroexpand and store the error the first time (TODO-ish)
    if !haskey(cell_expanded_exprs, cell_id) || cell_expanded_exprs[cell_id].original_expr_hash != expr_hash(expr)
        try
            try_macroexpand(m, notebook_id, cell_id, expr; capture_stdout)
        catch e
            result = CapturedException(e, catch_backtrace())
            cell_results[cell_id], cell_runtimes[cell_id] = (result, nothing)
            return (result, nothing)
        end
    end

    # We can be sure there is a cached expression now, yay
    expanded_cache = cell_expanded_exprs[cell_id]
    original_expr = expr
    expr = expanded_cache.expanded_expr

    # Re-play logs from expansion cache
    for log in expanded_cache.expansion_logs
        (level, msg, _module, group, id, file, line, kwargs) = log
        Logging.handle_message(logger, level, msg, _module, group, id, file, line; kwargs...)
    end
    empty!(expanded_cache.expansion_logs)

    # We add the time it took to macroexpand to the time for the first call,
    # but we make sure we don't mention it on subsequent calls
    expansion_runtime = if expanded_cache.did_mention_expansion_time === false
        did_mention_expansion_time = true
        cell_expanded_exprs[cell_id] = CachedMacroExpansion(
            expanded_cache.original_expr_hash,
            expanded_cache.expanded_expr,
            expanded_cache.expansion_duration,
            expanded_cache.has_pluto_hook_features,
            did_mention_expansion_time,
            expanded_cache.expansion_logs,
        )
        expanded_cache.expansion_duration
    else
        zero(UInt64)
    end

    if contains_macrocall(expr)
        @error "Expression contains a macrocall" expr
        throw("Expression still contains macro calls!!")
    end

    result, runtime = with_logger_and_io_to_logs(logger; capture_stdout) do # about 200ns + 3ms overhead
        if function_wrapped_info === nothing
            toplevel_expr = Expr(:toplevel, expr)
            wrapped = timed_expr(toplevel_expr)
            ans, runtime = run_inside_trycatch(m, wrapped)
            (ans, add_runtimes(runtime, expansion_runtime))
        else
            expr_id = forced_expr_id !== nothing ? forced_expr_id : expr_hash(expr)
            local computer = get(computers, cell_id, nothing)
            if computer === nothing || computer.expr_id !== expr_id
                try
                    computer = register_computer(expr, expr_id, cell_id, collect.(function_wrapped_info)...)
                catch e
                    # @error "Failed to generate computer function" expr exception=(e,stacktrace(catch_backtrace()))
                    return run_expression(m, original_expr, notebook_id, cell_id, nothing; user_requested_run=user_requested_run)
                end
            end

            # This check solves the problem of a cell like `false && variable_that_does_not_exist`. This should run without error, but will fail in our function-wrapping-magic because we get the value of `variable_that_does_not_exist` before calling the generated function.
            # The fix is to detect this situation and run the expression in the classical way.
            ans, runtime = if any(name -> !isdefined(m, name), computer.input_globals)
                # Do run_expression but with function_wrapped_info=nothing so it doesn't go in a Computer()
                # @warn "Got variables that don't exist, running outside of computer" not_existing=filter(name -> !isdefined(m, name), computer.input_globals)
                run_expression(m, original_expr, notebook_id, cell_id; user_requested_run)
            else
                run_inside_trycatch(m, () -> compute(m, computer))
            end

            ans, add_runtimes(runtime, expansion_runtime)
        end
    end
    
    currently_running_cell_id[] = old_currently_running_cell_id
    

    if (result isa CapturedException) && (result.ex isa InterruptException)
        throw(result.ex)
    end
    
    cell_results[cell_id], cell_runtimes[cell_id] = result, runtime
end
precompile(run_expression, (Module, Expr, UUID, UUID, Nothing, Nothing))

# Channel to trigger implicits run
const run_channel = Channel{UUID}(10)

function rerun_cell_from_notebook(cell_id::UUID)
    # make sure only one of this cell_id is in the run channel
    # by emptying it and filling it again
    new_uuids = UUID[]
    while isready(run_channel)
        uuid = take!(run_channel)
        if uuid != cell_id
            push!(new_uuids, uuid)
        end
    end
    for uuid in new_uuids
        put!(run_channel, uuid)
    end

    put!(run_channel, cell_id)
end

