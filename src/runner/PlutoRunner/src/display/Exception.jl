
"Downstream packages can set this to false to obtain unprettified stack traces."
const PRETTY_STACKTRACES = Ref(true)



function frame_is_from_plutorunner(frame::Base.StackTraces.StackFrame)
    if frame.linfo isa Core.MethodInstance
        frame.linfo.def.module === PlutoRunner
    else
        endswith(String(frame.file), "PlutoRunner.jl")
    end
end

frame_is_from_usercode(frame::Base.StackTraces.StackFrame) = occursin("#==#", String(frame.file))

function method_from_frame(frame::Base.StackTraces.StackFrame)
    if frame.linfo isa Core.MethodInstance
        frame.linfo.def
    elseif frame.linfo isa Method
        frame.linfo
    else
        nothing
    end
end

frame_url(m::Method) = Base.url(m)
frame_url(::Any) = nothing

function source_package(m::Union{Method,Module})
    next = parentmodule(m)
    next === m ? m : source_package(next)
end
source_package(::Any) = nothing

function format_output(val::CapturedException; context=default_iocontext)
    if val.ex isa PrettySyntaxError
        dict = convert_parse_error_to_dict(val.ex.ex.detail)
        return dict, MIME"application/vnd.pluto.parseerror+object"()
    end

    if PRETTY_STACKTRACES[]
        ## We hide the part of the stacktrace that belongs to Pluto's evalling of user code.
        stack = [s for (s, _) in val.processed_bt]

        # function_wrap_index = findfirst(f -> occursin("function_wrapped_cell", String(f.func)), stack)

        function_wrap_index = findlast(frame_is_from_usercode, stack)
        internal_index = findfirst(frame_is_from_plutorunner, stack)

        limit = if function_wrap_index !== nothing
            function_wrap_index
        elseif internal_index !== nothing
            internal_index - 1
        else
            nothing
        end
        stack_relevant = stack[1:something(limit, end)]

        pretty = map(stack_relevant) do s
            func = s.func === nothing ? nothing : s.func isa Symbol ? String(s.func) : repr(s.func)
            method = method_from_frame(s)
            sp = source_package(method)
            pm = method isa Method ? parentmodule(method) : nothing
            call = replace(pretty_stackcall(s, s.linfo), r"Main\.var\"workspace#\d+\"\." => "")

            Dict(
                :call => call,
                :call_short => type_depth_limit(call, 0),
                :func => func,
                :inlined => s.inlined,
                :from_c => s.from_c,
                :file => basename(String(s.file)),
                :path => String(s.file),
                :line => s.line,
                :linfo_type => string(typeof(s.linfo)),
                :url => frame_url(method),
                :source_package => sp === nothing ? nothing : string(sp),
                :parent_module => pm === nothing ? nothing : string(pm),
            )
        end

        (
            Dict{Symbol,Any}(
                :msg => sprint(try_showerror, val.ex),
                :stacktrace => pretty,
                :plain_error => sprint() do io
                    try_showerror(io, val.ex, val.processed_bt[1:something(limit, end)]; color=false)
                end,
            ),
            MIME"application/vnd.pluto.stacktrace+object"()
        )
    else
        Dict{Symbol,Any}(:msg => sprint(try_showerror, val.ex), :stacktrace => val), MIME"application/vnd.pluto.stacktrace+object"()
    end
end


# from the Julia source code:
function pretty_stackcall(frame::Base.StackFrame, linfo::Nothing)::String
    if frame.func isa Symbol
        if occursin("function_wrapped_cell", String(frame.func))
            "top-level scope"
        else
            String(frame.func)
        end
    else
        repr(frame.func)
    end
end

function pretty_stackcall(frame::Base.StackFrame, linfo::Core.CodeInfo)
    "top-level scope"
end

function pretty_stackcall(frame::Base.StackFrame, linfo::Union{Core.MethodInstance, Core.CodeInstance})
    if linfo.def isa Union{Method,Core.MethodInstance}
        @static if isdefined(Base.StackTraces, :show_spec_linfo) && hasmethod(Base.StackTraces.show_spec_linfo, Tuple{IO, Base.StackFrame})
            sprint(Base.StackTraces.show_spec_linfo, frame; context=:backtrace => true)
        else
            split(string(frame), " at ") |> first
        end
    else
        sprint(Base.show, linfo)
    end
end

function pretty_stackcall(frame::Base.StackFrame, linfo::Method)
    sprint(Base.show_tuple_as_call, linfo.name, linfo.sig)
end

function pretty_stackcall(frame::Base.StackFrame, linfo::Module)
    sprint(Base.show, linfo)
end


function type_depth_limit(call::String, n::Int)
    !occursin("{" , call) && return call
    @static if isdefined(Base, :type_depth_limit) && hasmethod(Base.type_depth_limit, Tuple{String, Int})
        Base.type_depth_limit(call, n)
    else
        call
    end
end


"Because even showerror can error... 👀"
function try_showerror(io::IO, e, args...; color::Bool=true)
    try
        showerror(IOContext(io, :color => color), e, args...)
    catch show_ex
        print(io, "\nFailed to show error:\n\n")
        try_showerror(io, show_ex, stacktrace(catch_backtrace()))
    end
end
