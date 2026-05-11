    
Base.@kwdef struct DivElement
    children::Vector
    style::String=""
    class::Union{String,Nothing}=nothing
end

tree_data(@nospecialize(e::DivElement), context::Context) = Dict{Symbol, Any}(
    :style => e.style, 
    :classname => e.class, 
    :children => Any[
        with_auto_id_counter(context, i) do io
            format_output_default(value, io)
        end
        for (i, value) in enumerate(e.children)
    ],
)
pluto_showable(::MIME"application/vnd.pluto.divelement+object", ::DivElement) = true

function Base.show(io::IO, m::MIME"text/html", e::DivElement)
    Base.show(io, m, embed_display(e))
end
