import Dates: DateTime
using UUIDs

"""
**(Internal API.)** A `Ref` containing the id of the cell that is currently **running** or **displaying**.
"""
const currently_running_cell_id = Ref{UUID}(UUIDs.uuid4())

function core_published_to_js(io, x)
    assertpackable(x)

    id_start = objectid2str(x)
    
    _notebook_id = get(io, :pluto_notebook_id, notebook_id[])::UUID
    _cell_id = get(io, :pluto_cell_id, currently_running_cell_id[])::UUID
    
    # The unique identifier of this object
    id = "$_notebook_id/$id_start"
    
    d = get!(Dict{String,Any}, cell_published_objects, _cell_id)
    d[id] = x
    
    write(io, "/* See the documentation for AbstractPlutoDingetjes.Display.published_to_js */ getPublishedObject(\"$(id)\")")
    
    return nothing
end

const Packable = Union{Nothing,Missing,String,Symbol,Int64,Int32,Int16,Int8,UInt64,UInt32,UInt16,UInt8,Float32,Float64,Bool,MIME,UUID,DateTime}
assertpackable(::Packable) = nothing
assertpackable(t::Any) = throw(ArgumentError("Only simple objects can be shared with JS, like vectors and dictionaries. $(string(typeof(t))) is not compatible."))
assertpackable(::Vector{<:Packable}) = nothing
assertpackable(::Dict{<:Packable,<:Packable}) = nothing
assertpackable(x::Vector) = foreach(assertpackable, x)
assertpackable(d::Dict) = let
    foreach(assertpackable, keys(d))
    foreach(assertpackable, values(d))
end
assertpackable(t::Tuple) = foreach(assertpackable, t)
assertpackable(t::NamedTuple) = foreach(assertpackable, t)