# The goal of this file is to import PlutoRunner into Main, on the process of the notebook (created by Malt.jl).
# 
# This is difficult because PlutoRunner uses standard libraries and packages that are not necessarily available in the standard environment. 
# 
# Our solution is to create a temporary environment just for loading PlutoRunner. This environment is stored in a scratchspace parameterized by the Pluto version and julia version,
# and used by all notebook launches. Reusing the environment means extra speed.


begin
    pushfirst!(LOAD_PATH, "@stdlib")
    import Pkg
    popfirst!(LOAD_PATH)

    local original_LP = copy(LOAD_PATH)
    local original_AP = Base.ACTIVE_PROJECT[]

    # Path to our notebook boot package environment which is set by WorkspaceManager
    # when spawning the process.
    local runner_env_dir = pluto_boot_environment_path

    local new_LP = ["@", "@stdlib"]
    local new_AP = runner_env_dir

    try
        # Activate the environment
        copy!(LOAD_PATH, new_LP)
        Base.ACTIVE_PROJECT[] = new_AP
        
        function setup()
            # Set up our notebook boot package environment by adding a single package:
            path = joinpath(@__DIR__, "PlutoRunner")
            try
                Pkg.develop([Pkg.PackageSpec(; path)])
                # Pkg.develop([Pkg.PackageSpec(; path)]; io=devnull)
            catch
                @warn "Something went wrong while initializing the notebook boot environment... Trying again and showing you the output."
                Pkg.develop([Pkg.PackageSpec(; path)])
            end
    
            # Resolve
            try
                Pkg.resolve(; io=devnull) # supress IO
            catch
                @warn "Something went wrong while initializing the notebook boot environment... Trying again and showing you the output."
                try
                    Pkg.resolve()
                catch e
                    @error "Failed to resolve notebook boot environment" exception = (e, catch_backtrace())
                end
            end
    
            # Instantiate
            try
                # we don't suppress IO for this one because it can take very long, and that would be a frustrating experience without IO
                # precompilation switched off because of https://github.com/fonsp/Pluto.jl/issues/875
                Pkg.instantiate(; update_registry=false, allow_autoprecomp=false)
            catch e
                @error "Failed to instantiate notebook boot environment" exception = (e, catch_backtrace())
            end
        end

        if !isfile(joinpath(new_AP, "Project.toml")) || !isfile(joinpath(new_AP, "Manifest.toml"))
            setup()
        end

        try
            # Import PlutoRunner into Main
            # try the first time without setup
            # This might trigger precompilation, which is actually what we want.
            import PlutoRunner
        catch
            # this means that setup is needed.
            setup()
            import PlutoRunner
        end
    finally
        # Reset the pkg environment
        copy!(LOAD_PATH, original_LP)
        Base.ACTIVE_PROJECT[] = original_AP
    end
end
