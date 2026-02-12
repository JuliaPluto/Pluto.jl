module TempDirInScratch
using Random
using Dates
import Scratch

const ROOT_DIR_OVERRIDE = Ref{Union{Nothing, AbstractString}}(nothing)
root() = @something(ROOT_DIR_OVERRIDE[], Scratch.@get_scratch!("pkg_envs"))

const name_rng = MersenneTwister(time_ns())

function tempdir(; allow_cleanup::Bool=true)
    super_rng = MersenneTwister(time_ns() + rand(name_rng, UInt64))
    dirname = joinpath(root(), "env_$(join(rand(super_rng, 'a':'z', 10)))")
    mkdir(dirname)
    
    allow_cleanup && cleanup()
    
    dirname
end

function cleanup(; max_age::Period=Hour(5))
    current_time = nowtime()
    try
        for dir in readdir(root(); join=true)
            if isdir(dir)
                try
                    last_time = recursive_stat(dir) |> unix2datetime
                    if last_time < current_time - max_age
                        rm(dir; recursive=true)
                    end
                catch e
                    @warn "Failed to delete temporary package environment dir $dir" exception=(e, catch_backtrace())
                end
            end
        end
    catch e
        @warn "Error while cleaning up temporary package environment dirs" exception=(e, catch_backtrace())
    end
end

function recursive_stat(start::AbstractString)
	local result = 0.0
    function yo(path)
        st = stat(path)
        result = max(
            result, 
            st.ctime,
            st.mtime,
        )
    end
    yo(start)
    for (root, dirs, files) in walkdir(start)
        foreach(yo, joinpath.((root,), dirs))
        foreach(yo, joinpath.((root,), files))
    end
    result
end

function mark_as_current(dirname::AbstractString)
    try
        p = joinpath(dirname, "Project.toml")
        isfile(p) && touch(p)
    catch e
        @error "Error marking temporary package environment dir $dirname as current" exception=(e, catch_backtrace())
    end
end


function nowtime()
    try
        dir = Scratch.@get_scratch!("time_test")
        file = joinpath(dir, "test.txt")
        touch(file)
        recursive_stat(dir) |> unix2datetime
    catch e
        @warn "Error getting current filesystem time, using fallback" exception=(e, catch_backtrace())
        now(UTC)
    end
end
end