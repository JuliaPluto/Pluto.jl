module PlutoApp

using Pluto
import Comonicon

# Note we need the `# Intro` header for Comonicon to pick up this docstring.
"""
# Intro
The `pluto` executable exposes a simple CLI interface for the `Pluto.run(; ...)` function.
It is supposed to be used via Julia ["apps"](https://pkgdocs.julialang.org/v1/apps/) from Julia 1.11+ and typically lives in your `\$PATH`.
It can be installed via `julia -e "import Pkg; Pkg.Apps.add(\"Pluto\")"`.
"""
Comonicon.@main function pluto(notebooks::String...;
    dont_launch_browser::Bool=false, # Comonicon flags must default to false
    port::Int=-1,  # Union{Nothing, Int} not supported by Comonicon
    host::String="127.0.0.1",
    auto_reload_from_file::Bool=false
)
    notebook = (isempty(notebooks) ? nothing : collect(notebooks))
    port = (port == -1 ? nothing : port)
    launch_browser = !dont_launch_browser
    Pluto.run(; notebook, launch_browser, port, host, auto_reload_from_file)
    return
end
function (Base.@main)(ARGS::Vector{String})
    # this function is generated into the current module by Comonicon
    # and will ultimately call the function above annotated by `Comonicon.@main`
    return command_main(ARGS)
end

end
