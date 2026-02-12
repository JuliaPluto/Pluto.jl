
Base.@kwdef struct Integration
    id::Base.PkgId
    code::Expr
    loaded::Ref{Bool}=Ref(false)
end

# We have a super cool viewer for objects that are a Tables.jl table. To avoid version conflicts, we only load this code after the user (indirectly) loaded the package Tables.jl.
# This is similar to how Requires.jl works, except we don't use a callback, we just check every time.
const integrations = Integration[
    Integration(
        id = Base.PkgId(Base.UUID(reinterpret(UInt128, codeunits("Paul Berg Berlin")) |> first), "AbstractPlutoDingetjes"),
        code = quote
            @assert v"1.0.0" <= AbstractPlutoDingetjes.MY_VERSION < v"2.0.0"
            
            supported!(xs...) = append!(supported_integration_features, xs)
            
            # don't need feature checks for these because they existed in every version of AbstractPlutoDingetjes:
            supported!(
                AbstractPlutoDingetjes,
                AbstractPlutoDingetjes.Bonds,
                AbstractPlutoDingetjes.Bonds.initial_value,
                AbstractPlutoDingetjes.Bonds.transform_value,
                AbstractPlutoDingetjes.Bonds.possible_values,
            )
            initial_value_getter_ref[] = AbstractPlutoDingetjes.Bonds.initial_value
            transform_value_ref[] = AbstractPlutoDingetjes.Bonds.transform_value
            possible_bond_values_ref[] = AbstractPlutoDingetjes.Bonds.possible_values
            
            # feature checks because these were added in a later release of AbstractPlutoDingetjes
            if isdefined(AbstractPlutoDingetjes, :Display)
                supported!(AbstractPlutoDingetjes.Display)
                if isdefined(AbstractPlutoDingetjes.Display, :published_to_js)
                    supported!(AbstractPlutoDingetjes.Display.published_to_js)
                end
                if isdefined(AbstractPlutoDingetjes.Display, :with_js_link)
                    supported!(AbstractPlutoDingetjes.Display.with_js_link)
                end
            end

        end,
    ),
    Integration(
        id = Base.PkgId(UUID("0c5d862f-8b57-4792-8d23-62f2024744c7"), "Symbolics"),
        code = quote
            pluto_showable(::MIME"application/vnd.pluto.tree+object", ::Symbolics.Arr) = false
        end,
    ),
    Integration(
        id = Base.PkgId(UUID("0703355e-b756-11e9-17c0-8b28908087d0"), "DimensionalData"),
        code = quote
            pluto_showable(::MIME"application/vnd.pluto.tree+object", ::DimensionalData.DimArray) = false
        end,
    ),
    Integration(
        id = Base.PkgId(UUID("bd369af6-aec1-5ad0-b16a-f7cc5008161c"), "Tables"),
        code = quote
            function maptruncated(f::Function, xs, filler, limit; truncate=true)
                if truncate
                    result = Any[
                        # not xs[1:limit] because of https://github.com/JuliaLang/julia/issues/38364
                        f(xs[i]) for i in Iterators.take(eachindex(xs), limit)
                    ]
                    push!(result, filler)
                    result
                else
                    Any[f(x) for x in xs]
                end
            end

            function table_data(x::Any, io::Context)
                rows = Tables.rows(x)
                my_row_limit = get_my_display_limit(x, 1, 0, io, table_row_display_limit, table_row_display_limit_increase)

                # TODO: the commented line adds support for lazy loading columns, but it uses the same extra_items counter as the rows. So clicking More Rows will also give more columns, and vice versa, which isn't ideal. To fix, maybe use (objectid,dimension) as index instead of (objectid)?

                my_column_limit = get_my_display_limit(x, 2, 0, io, table_column_display_limit, table_column_display_limit_increase)
                # my_column_limit = table_column_display_limit

                # additional 5 so that we don't cut off 1 or 2 itmes - that's silly
                truncate_rows = my_row_limit + 5 < length(rows)
                truncate_columns = if isempty(rows)
                    false
                else
                    my_column_limit + 5 < length(first(rows))
                end

                row_data_for(row) = maptruncated(row, "more", my_column_limit; truncate=truncate_columns) do el
                    format_output_default(el, io)
                end

                # ugliest code in Pluto:

                # not a map(row) because it needs to be a Vector
                # not enumerate(rows) because of some silliness
                # not rows[i] because `getindex` is not guaranteed to exist
                L = truncate_rows ? my_row_limit : length(rows)
                row_data = Vector{Any}(undef, L)
                for (i, row) in zip(1:L,rows)
                    row_data[i] = (i, row_data_for(row))
                end

                if truncate_rows
                    push!(row_data, "more")

                    # In some environments this fails. Not sure why.
                    last_row = applicable(lastindex, rows) ? try last(rows) catch e nothing end : nothing
                    if !isnothing(last_row)
                        push!(row_data, (length(rows), row_data_for(last_row)))
                    end
                end
                
                # TODO: render entire schema by default?

                schema = Tables.schema(rows)
                schema_data = schema === nothing ? nothing : Dict{Symbol,Any}(
                    :names => maptruncated(string, schema.names, "more", my_column_limit; truncate=truncate_columns),
                    :types => String.(maptruncated(trynameof, schema.types, "more", my_column_limit; truncate=truncate_columns)),
                )

                Dict{Symbol,Any}(
                    :objectid => objectid2str(x),
                    :schema => schema_data,
                    :rows => row_data,
                )
            end


            #=
            If the object we're trying to fileview provides rowaccess, let's try to show it. This is guaranteed to be fast
            (while Table.rows() may be slow). If the object is a lazy iterator, the show method will probably crash and return text repr.
            That's good because we don't want the show method of lazy iterators (e.g. database cursors) to be changing the (external)
            iterator implicitly =#
            pluto_showable(::MIME"application/vnd.pluto.table+object", x::Any) = try Tables.rowaccess(x)::Bool catch; false end
            pluto_showable(::MIME"application/vnd.pluto.table+object", t::Type) = false
            pluto_showable(::MIME"application/vnd.pluto.table+object", t::AbstractVector{<:NamedTuple}) = false
            pluto_showable(::MIME"application/vnd.pluto.table+object", t::AbstractVector{<:AbstractDict}) = false
            pluto_showable(::MIME"application/vnd.pluto.table+object", t::AbstractVector{Union{}}) = false

        end,
    ),
    Integration(
        id = Base.PkgId(UUID("91a5bcdd-55d7-5caf-9e0b-520d859cae80"), "Plots"),
        code = quote
            approx_size(p::Plots.Plot) = try
                sum(p.series_list; init=0) do series
                    length(something(get(series, :y, ()), ()))
                end
            catch e
                @warn "Failed to guesstimate plot size" exception=(e,catch_backtrace())
                0
            end
            const max_plot_size = 8000
            function pluto_showable(::MIME"image/svg+xml", p::Plots.Plot{Plots.GRBackend})
                format = try
                    p.attr[:html_output_format]
                catch
                    :auto
                end
                
                format === :svg || (
                    format === :auto && approx_size(p) <= max_plot_size
                )
            end
            pluto_showable(::MIME"text/html", p::Plots.Plot{Plots.GRBackend}) = false
        end,
    ),
    Integration(
        id = Base.PkgId(UUID("4e3cecfd-b093-5904-9786-8bbb286a6a31"), "ImageShow"),
        code = quote
            pluto_showable(::MIME"text/html", ::AbstractMatrix{<:ImageShow.Colorant}) = false
        end,
    ),
    Integration(
        id = Base.PkgId(UUID("94b1ba4f-4ee9-5380-92f1-94cde586c3c5"), "AxisKeys"),
        code = quote
            pluto_showable(::MIME"application/vnd.pluto.tree+object", ::AxisKeys.KeyedArray) = false
            pluto_showable(::MIME"application/vnd.pluto.table+object", ::AxisKeys.KeyedArray) = false
        end,
    ),
    Integration(
        id = Base.PkgId(UUID("33c8b6b6-d38a-422a-b730-caa89a2f386c"), "ProgressLogging"),
        code = quote
            preprocess_log_msg(ps::ProgressLogging.ProgressString) = ps.progress.name
        end,
    ),
]

function load_integration_if_needed(integration::Integration)
    if !integration.loaded[] && haskey(Base.loaded_modules, integration.id)
        load_integration(integration)
    end
end

load_integrations_if_needed() = load_integration_if_needed.(integrations)

function load_integration(integration::Integration)
    integration.loaded[] = true
    try
        eval(quote
            const $(Symbol(integration.id.name)) = Base.loaded_modules[$(integration.id)]
            $(integration.code)
        end)
        true
    catch e
        @error "Failed to load integration with $(integration.id.name).jl" exception=(e, catch_backtrace())
        false
    end
end
