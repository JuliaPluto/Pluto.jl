const StackElement = Union{Symbol,Int}

function auto_id!(io::IO)::String
    stack = get(io, :script_id_counter, StackElement[])::Vector{StackElement}

    if length(stack) >= 1
        stack[end] += 1
        join(stack, ",")
    else
        # Fallback for when @auto_id is used inside an IO that never received a counter stack:
        string(rand(Int))
    end
end

function with_counter(f::Function, io::IO, addkey::Union{StackElement,Nothing}=nothing)
    oldstack = get(io, :script_id_counter, StackElement[])::Vector{StackElement}

    newstack = if addkey === nothing
        StackElement[oldstack..., 0]
    else
        StackElement[oldstack..., addkey, 0]
    end

    f(IOContext(io, :script_id_counter => newstack))
end
