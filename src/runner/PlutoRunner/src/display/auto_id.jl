const AutoIDStackElement = Union{Symbol,Int64}

function auto_id!(io::IO)::String
    stack = get(io, :pluto_auto_id_counter, AutoIDStackElement[])::Vector{AutoIDStackElement}

    if length(stack) >= 1
        stack[end] += 1
        join(stack, ",")
    else
        # Fallback for when @auto_id is used inside an IO that never received a counter stack:
        string("PlutoRunner-auto-id-fallback", rand(Int64))
    end
end

function with_auto_id_counter(f::Function, io::IO, addkey::Union{AutoIDStackElement,Nothing}=nothing)
    oldstack = get(io, :pluto_auto_id_counter, AutoIDStackElement[])::Vector{AutoIDStackElement}

    newstack = if addkey === nothing
        AutoIDStackElement[oldstack..., 0]
    else
        AutoIDStackElement[oldstack..., addkey, 0]
    end

    f(IOContext(io, :pluto_auto_id_counter => newstack))
end
