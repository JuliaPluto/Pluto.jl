module PkgCompat

export package_versions, registered_package_names

import REPL
import Pkg
import Pkg.Types: VersionRange
import RegistryInstances
import ..Pluto
import Scratch
import UUIDs
import GracefulPkg
import ..TempDirInScratch
import TOML


@static if isdefined(Pkg,:REPLMode) && isdefined(Pkg.REPLMode, :complete_remote_package)
    const REPLMode = Pkg.REPLMode
else
    const REPLMode = Base.get_extension(Pkg, :REPLExt)
end

const flatmap = collect ∘ Iterators.flatmap

# Should be in Base
function select(f::Function, xs)
	for x ∈ xs
		if f(x)
			return x
		end
	end
	nothing
end


#=

NOTE ABOUT PUBLIC/INTERNAL PKG API

Pkg.jl exposes lots of API, but only some of it is "public": guaranteed to remain available. API is public if it is listed here:
https://pkgdocs.julialang.org/v1/api/

In this file, I labeled functions by their status using 🐸, ⚠️, etc.

A status in brackets (like this) means that it is only called within this file, and the fallback might be in a caller function.

---

I tried to only use public API, except:
- I use the `Pkg.Types.Context` value as first argument for many functions, since the server process manages multiple notebook processes, each with their own package environment. We could get rid of this, by settings `Base.ACTIVE_PROJECT[]` before and after each Pkg call. (This is temporarily activating the notebook environment.) This does have a performance impact, since the project and manifest caches are regenerated every time.
- https://github.com/JuliaLang/Pkg.jl/issues/2607 seems to be impossible with the current public API.
- Some functions try to use internal API for optimization/better features.

=#





###
# CONTEXT
###


const PkgContext = if isdefined(Pkg, :Types) && isdefined(Pkg.Types, :Context)
	Pkg.Types.Context
elseif isdefined(Pkg, :API) && isdefined(Pkg.API, :Context)
	Pkg.API.Context
else
	Pkg.Types.Context
end

function PkgContext!(ctx::PkgContext; kwargs...)
    for (k, v) in kwargs
        setfield!(ctx, k, v)
    end
    ctx
end

# 🐸 "Public API", but using PkgContext
load_ctx(env_dir)::PkgContext = PkgContext(;env=Pkg.Types.EnvCache(joinpath(env_dir, "Project.toml")))

# 🐸 "Public API", but using PkgContext
load_ctx!(ctx::PkgContext, env_dir)::PkgContext = PkgContext!(ctx; env=Pkg.Types.EnvCache(joinpath(env_dir, "Project.toml")))

# 🐸 "Public API", but using PkgContext
load_empty_ctx!(ctx) = @static if :io ∈ fieldnames(PkgContext)
    PkgContext!(create_empty_ctx(); io=ctx.io)
else
    create_empty_ctx()
end

# 🐸 "Public API", but using PkgContext
create_empty_ctx()::PkgContext = load_ctx!(PkgContext(), TempDirInScratch.tempdir())

# ⚠️ Internal API with fallback
function load_ctx!(original::PkgContext)
	original_project = deepcopy(original.env.original_project)
	original_manifest = deepcopy(original.env.original_manifest)
	new = load_ctx!(original, env_dir(original))

	try
		new.env.original_project = original_project
		new.env.original_manifest = original_manifest
	catch e
		@warn "Pkg compat: failed to set original_project" exception=(e,catch_backtrace())
	end

	new
end

# ⚠️ Internal API with fallback
function mark_original!(ctx::PkgContext)
	try
		ctx.env.original_project = deepcopy(ctx.env.project)
		ctx.env.original_manifest = deepcopy(ctx.env.manifest)
	catch e
		@warn "Pkg compat: failed to set original_project" exception=(e,catch_backtrace())
	end
end

# ⚠️ Internal API with fallback
function is_original(ctx::PkgContext)::Bool
	try
		ctx.env.original_project == ctx.env.project &&
		ctx.env.original_manifest == ctx.env.manifest
	catch e
		@warn "Pkg compat: failed to get original_project" exception=(e,catch_backtrace())
		false
	end
end



# 🐸 "Public API", but using PkgContext
env_dir(ctx::PkgContext) = dirname(ctx.env.project_file)

project_file(x::AbstractString) = joinpath(x, "Project.toml")
manifest_file(x::AbstractString) = joinpath(x, "Manifest.toml")
project_file(ctx::PkgContext) = joinpath(env_dir(ctx), "Project.toml")
manifest_file(ctx::PkgContext) = joinpath(env_dir(ctx), "Manifest.toml")
function read_project_file(x)::String
	path = project_file(x)
	isfile(path) ? read(path, String) : ""
end
function read_manifest_file(x)::String
	path = manifest_file(x)
	isfile(path) ? read(path, String) : ""
end


# ⚠️ Internal API with fallback
function withio(f::Function, ctx::PkgContext, io::IO)
    @static if :io ∈ fieldnames(PkgContext)
        old_io = ctx.io
        ctx.io = io
        result = try
			f()
		finally
        	ctx.io = old_io
			nothing
		end
        result
    else
        f()
    end
end

@static if !(v"1.11.7" <= VERSION < v"1.12.0-aaa" || VERSION >= v"1.12.0-rc1")
	# Versions that do no include https://github.com/JuliaLang/julia/pull/58887
	# I'm a pirate harrr 🏴‍☠️
	@static if isdefined(Pkg, :can_fancyprint)
		Pkg.can_fancyprint(io::Union{IOContext{IOBuffer},IOContext{Base.BufferStream}}) = 
			get(io, :sneaky_enable_tty, false) === true
	end
	@static if isdefined(Base, :Precompilation) && isdefined(Base.Precompilation, :can_fancyprint)
		Base.Precompilation.can_fancyprint(io::Union{IOContext{IOBuffer},IOContext{Base.BufferStream}}) = 
			get(io, :sneaky_enable_tty, false) === true
	end
end

###
# REGISTRIES
###

# (✅ "Public" API using RegistryInstances)
"Return all installed registries as `RegistryInstances.RegistryInstance` structs."
_get_registries() = RegistryInstances.reachable_registries()

# (✅ "Public" API using RegistryInstances)
"The cached output value of `_get_registries`."
const _parsed_registries = Ref(RegistryInstances.RegistryInstance[])

# (✅ "Public" API using RegistryInstances)
"Re-parse the installed registries from disk."
function refresh_registry_cache()
	_parsed_registries[] = _get_registries()
end


# ⚠️✅ Internal API with fallback
const _updated_registries_compat = @static if isdefined(Pkg, :UPDATED_REGISTRY_THIS_SESSION) && Pkg.UPDATED_REGISTRY_THIS_SESSION isa Ref{Bool}
	Pkg.UPDATED_REGISTRY_THIS_SESSION
else
	Ref(false)
end

# ✅ Public API
function update_registries(; force::Bool=false)
	if force || !_updated_registries_compat[]
		try
			Pkg.Registry.update()
		catch
			# sometimes it just fails but we dont want Pluto to be too sensitive to that
			Pkg.Registry.update()
		end
		try
			refresh_registry_cache()
		catch
		end
		_updated_registries_compat[] = true		
	end
end

# ✅ Public API
"""
Check when the registries were last updated. If it is recent (max 7 days), then `Pkg.UPDATED_REGISTRY_THIS_SESSION[]` is set to `true`, which will prevent Pkg from doing an automatic registry update.

Returns the new value of `Pkg.UPDATED_REGISTRY_THIS_SESSION[]`.
"""
function check_registry_age(max_age_ms = 1000.0 * 60 * 60 * 24 * 7)::Bool
	if get(ENV, "GITHUB_ACTIONS", "false") == "true"
		# don't do this optimization in CI
		return false
	end
	paths = [s.path for s in _get_registries()]
	isempty(paths) && return _updated_registries_compat[]
	
	mtimes = map(paths) do p
		try
			mtime(p)
		catch
			zero(time())
		end
	end
	
	if all(mtimes .> time() - max_age_ms)
		_updated_registries_compat[] = true
	end
	_updated_registries_compat[]
end


###
# Instantiate
###

# ⚠️ Internal API
function instantiate(ctx; update_registry::Bool, allow_autoprecomp::Bool)
	Pkg.instantiate(ctx; update_registry, allow_autoprecomp)
	# Not sure how to make a fallback:
	# - hasmethod cannot test for kwargs because instantiate takes kwargs... that are passed on somewhere else
	# - can't catch for a CallError because the error is weird
end


###
# Standard Libraries
###

# ✅ Public API
is_stdlib(package_name::String) = package_name ∈ GracefulPkg.stdlibs_past_present_future



# Initial fill of registry cache
function __init__()
    refresh_registry_cache()
    global global_ctx=PkgContext()
end

###
# Package names
###


# (✅ "Public" API)
"""
Return names of all registered packages.
"""
function registered_package_names(;registries::Vector=_parsed_registries[])::Vector{String}
	flatmap(registries) do reg
		packages = values(reg.pkgs)
		union!(String[
			d.name
			for d in packages
		], GracefulPkg.stdlibs_past_present_future)
	end |> sort!
end


###
# Package versions
###

# (✅ "Public" API)
"""
Return paths to all found registry entries of a given package name.

# Example
```julia
julia> Pluto.PkgCompat._registry_entries("Pluto")
1-element Vector{String}:
 "/Users/fons/.julia/registries/General/P/Pluto"
```
"""
function _registry_entries(package_name::AbstractString, registries::Vector=_parsed_registries[])::Vector{String}
	flatmap(registries) do reg
		packages = values(reg.pkgs)
		String[
			joinpath(reg.path, d.path)
			for d in packages
			if d.name == package_name
		]
	end
end


# ✅ "Public" API using RegistryInstances
"""
Return all registered versions of the given package. Returns `["stdlib"]` for standard libraries, a `Vector{VersionNumber}` for registered packages, or `["latest"]` if it crashed.
"""
function package_versions(package_name::AbstractString)::Vector
    if is_stdlib(package_name)
        ["stdlib"]
    else
		try
			flatmap(_parsed_registries[]) do reg
				uuids_with_name = RegistryInstances.uuids_from_name(reg, package_name)
				flatmap(uuids_with_name) do u
					pkg = get(reg, u, nothing)
					if pkg !== nothing
						info = RegistryInstances.registry_info(pkg)
						collect(keys(info.version_info))
					else
						[]
					end
				end
			end |> sort!
		catch e
			@warn "Pkg compat: failed to get installable versions." exception=(e,catch_backtrace())
			["latest"]
		end
    end
end

"""
Return a Vector of UUIDs for the given package name. Returns an empty Vector if the package was not found.
"""
function package_uuids(package_name::AbstractString)::Vector{Base.UUID}
	try
		flatmap(_parsed_registries[]) do reg
			RegistryInstances.uuids_from_name(reg, package_name)
		end
	catch e
		@warn "Pkg compat: failed to get package UUIDs." exception=(e,catch_backtrace())
		Base.UUID[]
	end
end

# ✅ "Public" API using RegistryInstances
"""
Return the URL of the package's documentation (if possible) or homepage. Returns `nothing` if the package was not found.
"""
function package_url(package_name::AbstractString)::Union{String,Nothing}
    if is_stdlib(package_name)
		"https://docs.julialang.org/en/v1/stdlib/$(package_name)/"
    else
		try
			for reg in _parsed_registries[]
				for u in RegistryInstances.uuids_from_name(reg, package_name)
					pkg = get(reg, u, nothing)
					if pkg !== nothing
						return RegistryInstances.registry_info(pkg).repo
					end
				end
			end
		catch e
			@warn "Pkg compat: failed to get package URL." exception=(e,catch_backtrace())
		end
    end
end

# ⚠️ Internal API with fallback
"Does a package with this name exist in one of the installed registries?"
package_exists(package_name::AbstractString)::Bool =
    package_versions(package_name) |> !isempty

# 🐸 "Public API", but using PkgContext
function dependencies(ctx)
	try
		# ctx.env.manifest
		@static if hasmethod(Pkg.dependencies, (PkgContext,))
			Pkg.dependencies(ctx)
		else
			Pkg.dependencies(ctx.env)
		end
	catch e
		if !any(occursin(sprint(showerror, e)), (
			"could not find source path for", # https://github.com/fonsp/Pluto.jl/issues/3176
			r"expected.*exist.*manifest",
			r"no method.*project_rel_path.*Nothing\)", # https://github.com/JuliaLang/Pkg.jl/issues/3404
		))
			@error """
			Pkg error: you might need to use

			Pluto.reset_notebook_environment(notebook_path)

			to reset this notebook's environment.

			Before doing so, consider sending your notebook file to https://github.com/JuliaPluto/Pluto.jl/issues together with the following info:
			""" Pluto.PLUTO_VERSION VERSION exception=(e,catch_backtrace())
		end

		Dict()
	
	end
end

function project(ctx::PkgContext)
	@static if hasmethod(Pkg.project, (PkgContext,))
		Pkg.project(ctx)
	else
		Pkg.project(ctx.env)
	end
end

function sysimage_module_names()
	@static if isdefined(Base, Symbol("_sysimage_modules"))
		getproperty.(Base._sysimage_modules, :name)
	else
		String[]
	end
end

# 🐸 "Public API", but using PkgContext
"Find a package in the manifest. Return `nothing` if not found."
_get_manifest_entry(ctx::PkgContext, package_name::AbstractString) = 
    select(e -> e.name == package_name, values(dependencies(ctx)))

# ⚠️ Internal API with fallback
"""
Find a package in the manifest given its name, and return its installed version. Return `"stdlib"` for a standard library, and `nothing` if not found.
"""
function get_manifest_version(ctx::PkgContext, package_name::AbstractString)
    if is_stdlib(package_name)
        "stdlib"
    else
        entry = _get_manifest_entry(ctx, package_name)
		entry === nothing ? nothing : entry.version
    end
end

###
# WRITING COMPAT ENTRIES
###


const _project_key_order = ["name", "uuid", "keywords", "license", "desc", "version", "workspace", "deps", "weakdeps", "sources", "extensions", "compat"]
project_key_order(key::String) =
    something(findfirst(x -> x == key, _project_key_order), length(_project_key_order) + 1)


# ✅ Public API
function _modify_compat!(f!::Function, ctx::PkgContext)::PkgContext
	project_path = project_file(ctx)
	
	toml = if isfile(project_path)
		TOML.parsefile(project_path)
	else
		Dict{String,Any}()
	end
	compat = get!(Dict{String,Any}, toml, "compat")
	
	f!(compat)

	isempty(compat) && delete!(toml, "compat")

	write(project_path, sprint() do io
		@static if VERSION > v"1.12.0-aaa"
			inline_tables = Base.IdSet{Dict}()
			if haskey(toml, "sources")
				for source in values(toml["sources"])
					source isa Dict || error("Expected `sources` to be a table")
					push!(inline_tables, source)
				end
			end
			TOML.print(io, toml; sorted=true, inline_tables, by=(key -> (project_key_order(key), key)))
		else
			# same but without inline_tables
			TOML.print(io, toml; sorted=true, by=(key -> (project_key_order(key), key)))
			
		end
	end)
	
	return _update_project_hash!(load_ctx!(ctx))
end

# ✅ Internal API with fallback
"Update the project hash in the manifest file (https://github.com/JuliaLang/Pkg.jl/pull/2815)"
function _update_project_hash!(ctx::PkgContext)
	isfile(manifest_file(ctx)) && try
		Pkg.Operations.record_project_hash(ctx.env)
		Pkg.Types.write_manifest(ctx.env)
	catch e
		@info "Failed to update project hash." exception=(e,catch_backtrace())
	end
	
	ctx
end


# ✅ Public API
"""
Add any missing [`compat`](https://pkgdocs.julialang.org/v1/compatibility/) entries to the `Project.toml` for all direct dependencies. This serves as a 'fallback' in case someone (with a different Julia version) opens your notebook without being able to load the `Manifest.toml`. Return the new `PkgContext`.

The automatic compat entry is: `"~" * string(installed_version)`.
"""
function write_auto_compat_entries!(ctx::PkgContext)::PkgContext
	_modify_compat!(ctx) do compat
		for p in keys(project(ctx).dependencies)
			if !haskey(compat, p)
				m_version = get_manifest_version(ctx, p)
				if m_version !== nothing && !is_stdlib(p)
					compat[p] = "~" * string(VersionNumber(m_version.major, m_version.minor, m_version.patch))  # drop build number
				end
			end
		end
	end
end


# ✅ Public API
"""
Remove any automatically-generated [`compat`](https://pkgdocs.julialang.org/v1/compatibility/) entries from the `Project.toml`. This will undo the effects of [`write_auto_compat_entries!`](@ref) but leave other (e.g. manual) compat entries intact. Return the new `PkgContext`.
"""
function clear_auto_compat_entries!(ctx::PkgContext)::PkgContext
	if isfile(project_file(ctx))
		_modify_compat!(ctx) do compat
			for p in keys(compat)
				if match(r"^~\d+\.\d+\.\d+$", compat[p]) !== nothing
					delete!(compat, p)
				end
			end
		end
	else
		ctx
	end
end

# ✅ Public API
"""
Remove any [`compat`](https://pkgdocs.julialang.org/v1/compatibility/) entries from the `Project.toml` for standard libraries. These entries are created when an old version of Julia uses a package that later became a standard library, like https://github.com/JuliaPackaging/Artifacts.jl. Return the new `PkgContext`.
"""
function clear_stdlib_compat_entries!(ctx::PkgContext)::PkgContext
	if isfile(project_file(ctx))
		_modify_compat!(ctx) do compat
			for p in keys(compat)
				if is_stdlib(p)
					@info "Removing compat entry for stdlib" p
					delete!(compat, p)
				end
			end
		end
	else
		ctx
	end
end


end
