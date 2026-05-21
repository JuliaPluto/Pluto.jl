
# Internal-only helper struct, superseded by `AbstractPlutoDingetjes.Display.ReactDOMElement`.
# Kept so existing internal call sites continue to work; its wire format is now produced by
# delegating to the new ReactDOMElement MIME.
Base.@kwdef struct DivElement
    children::Vector
    style::String=""
    class::Union{String,Nothing}=nothing
end

function Base.show(io::IO, ::MIME"application/vnd.pluto.reactdomelement+object", e::DivElement)
    attrs = Dict{String,Any}()
    isempty(e.style)    || (attrs["style"] = e.style)
    e.class === nothing || (attrs["class"] = e.class)
    # Build a ReactDOMElement-shaped value without taking a hard dep on AbstractPlutoDingetjes
    # being loaded: any object with `tag`, `attributes`, `children` fields is accepted by
    # `_reactdom_to_dict`.
    (tag = "div", attributes = attrs, children = e.children)
end

function Base.show(io::IO, m::MIME"text/html", e::DivElement)
    Base.show(io, m, embed_display(e))
end
