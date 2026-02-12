
module ANSIEmulation include("./ANSIEmulation.jl") end


"A polling system to watch for writes to a `Base.BufferStream`. Up-to-date content will be passed as string to the `callback` function."
Base.@kwdef struct IOListener
    callback::Function
    interval::Real=1.0/60
    running::Ref{Bool}=Ref(false)

    buffer::Base.BufferStream=Base.BufferStream()
    ansi_state::ANSIEmulation.ANSITerminalState=ANSIEmulation.ANSITerminalState()
end

function trigger(listener::IOListener)
    # if there is data...
    if !eof(listener.buffer) && isreadable(listener.buffer)
        # ...process it and...
        newdata = readavailable(listener.buffer)
        isempty(newdata) && return
        s = String(newdata)
        ANSIEmulation.consume_safe!(
            listener.ansi_state, 
            s
        )
        new_contents = ANSIEmulation.build_str(listener.ansi_state)

        # ...trigger the callback.
        listener.callback(new_contents)
    end
end

function startlistening(listener::IOListener)
    if !listener.running[]
        listener.running[] = true
        @async try
            while listener.running[]
                trigger(listener)
                sleep(listener.interval)
            end
        catch ex
            println(stderr, "IOListener loop error")
            showerror(stderr, ex, stacktrace(catch_backtrace()))
            rethrow(ex)
        end
    end
end
function stoplistening(listener::IOListener)
    if listener.running[]
        listener.running[] = false
        bytesavailable(listener.buffer) > 0 && trigger(listener)
        close(listener.buffer)
    end
end

# replace all pkg loading spinner states by the same character. the pluto frontend will make that character spin using CSS magic.
freeze_loading_spinners(s::AbstractString) = replace(s, '◑' => '◐', '◒' => '◐', '◓' => '◐')

"write a text with bold formatting"
function phasemessage(io::IO, phase::String)
    ioc = IOContext(io, :color=>true)
    printstyled(ioc, "\n$phase...\n"; bold=true)
    printstyled(ioc, "===\n"; color=:light_black)
end
phasemessage(iolistener, phase::String) = phasemessage(iolistener.buffer, phase)

