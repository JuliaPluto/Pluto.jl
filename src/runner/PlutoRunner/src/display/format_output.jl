

# This is not a struct to make it easier to pass these objects between processes.
const MimedOutput = Tuple{Union{String,Vector{UInt8},Dict{Symbol,Any}},MIME}
const ObjectDimPair = Tuple{ObjectID,Int64} # this is Int64 on 32 bit computers as well

const tree_display_limit = 30
const tree_display_limit_increase = 40
const table_row_display_limit = 10
const table_row_display_limit_increase = 60
const table_column_display_limit = 8
const table_column_display_limit_increase = 30

const tree_display_extra_items = Dict{UUID,Dict{ObjectDimPair,Int64}}() # this is Int64 on 32 bit computers as well

# This is not a struct to make it easier to pass these objects between processes.
const FormattedCellResult = NamedTuple{(:output_formatted, :errored, :interrupted, :process_exited, :runtime, :published_objects, :has_pluto_hook_features),Tuple{PlutoRunner.MimedOutput,Bool,Bool,Bool,Union{UInt64,Nothing},Dict{String,Any},Bool}}

function formatted_result_of(
    notebook_id::UUID, 
    cell_id::UUID, 
    ends_with_semicolon::Bool, 
    known_published_objects::Vector{String}=String[],
    showmore::Union{ObjectDimPair,Nothing}=nothing, 
    workspace::Module=Main;
    capture_stdout::Bool=true,
)::FormattedCellResult
    load_integrations_if_needed()
    currently_running_cell_id[] = cell_id

    extra_items = if showmore === nothing
        tree_display_extra_items[cell_id] = Dict{ObjectDimPair,Int64}()
    else
        old = get!(() -> Dict{ObjectDimPair,Int64}(), tree_display_extra_items, cell_id)
        old[showmore] = get(old, showmore, 0) + 1
        old
    end

    has_pluto_hook_features = haskey(cell_expanded_exprs, cell_id) && cell_expanded_exprs[cell_id].has_pluto_hook_features
    ans = cell_results[cell_id]
    errored = ans isa CapturedException

    output_formatted = if (!ends_with_semicolon || errored)
        with_logger_and_io_to_logs(get_cell_logger(notebook_id, cell_id); capture_stdout) do
            format_output(ans; context=IOContext(
            default_iocontext, 
            :extra_items=>extra_items, 
            :module => workspace,
            :pluto_notebook_id => notebook_id,
            :pluto_cell_id => cell_id,
        ))
        end
    else
        ("", MIME"text/plain"())
    end

    published_objects = get(cell_published_objects, cell_id, Dict{String,Any}())

    for k in known_published_objects
        if haskey(published_objects, k)
            published_objects[k] = nothing
        end
    end

    return (;
        output_formatted,
        errored,
        interrupted = false,
        process_exited = false,
        runtime = get(cell_runtimes, cell_id, nothing),
        published_objects,
        has_pluto_hook_features,
    )
end


"""
Format `val` using the richest possible output, return formatted string and used MIME type.

See [`allmimes`](@ref) for the ordered list of supported MIME types.
"""
function format_output_default(@nospecialize(val), @nospecialize(context=default_iocontext))::MimedOutput
    try
        io_sprinted, (value, mime) = show_richest_withreturned(context, val)
        if value === nothing
            if mime ∈ imagemimes
                (io_sprinted, mime)
            else
                (String(io_sprinted)::String, mime)
            end
        else
            (value, mime)
        end
    catch ex
        title = ErrorException("Failed to show value: \n" * sprint(try_showerror, ex))
        bt = catch_backtrace()
        format_output(CapturedException(title, bt))
    end
end

format_output(@nospecialize(x); context=default_iocontext) = format_output_default(x, context)

format_output(::Nothing; context=default_iocontext) = ("", MIME"text/plain"())



function format_output(binding::Base.Docs.Binding; context=default_iocontext)
    try
        ("""
        <div class="pluto-docs-binding">
        <span id="$(binding.var)">$(binding.var)</span>
        $(repr(MIME"text/html"(), Base.Docs.doc(binding)))
        </div>
        """, MIME"text/html"()) 
    catch e
        @warn "Failed to pretty-print binding" exception=(e, catch_backtrace())
        repr(binding, MIME"text/plain"())
    end
end

