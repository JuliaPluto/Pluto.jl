module PkgUtils

import FileWatching
import Pkg
import ..Pluto
import ..Pluto: Notebook, save_notebook, load_notebook, load_notebook_nobackup, withtoken, Token, readwrite, PkgCompat, WorkspaceManager
import ..Pluto.PkgCompat: project_file, manifest_file

using Markdown

export activate_notebook

ensure_has_nbpkg(notebook::Notebook) = if !will_use_pluto_pkg(notebook)

    # TODO: update_save the notebook to init packages and stuff?
    error("""
    This notebook is not using Pluto's package manager. This means that the notebook contains Pkg.activate or Pkg.add call.

    Open the notebook using Pluto to see what's up.
    """)
else
    for f in [notebook |> project_file, notebook |> manifest_file]
        isfile(f) || touch(f)
    end
end

function assert_has_manifest(dir::String)
    @assert isdir(dir)
    if !isfile(dir |> project_file)
        error("The given directory does not contain a Project.toml file -- it is not a package environment.")
    end
    if !isfile(dir |> manifest_file)
        error("The given directory does not contain a Manifest.toml file. Use `Pkg.resolve` to generate a Manifest.toml from a Project.toml.")
    end
end


function nb_and_dir_environments_equal(notebook::Notebook, dir::String)
    try
        ensure_has_nbpkg(notebook)
        assert_has_manifest(dir)
        true
    catch
        false
    end && let
        read(notebook |> project_file) == read(dir |> project_file) && 
        read(notebook |> manifest_file) == read(dir |> manifest_file)
    end
end


function write_nb_to_dir(notebook::Notebook, dir::String)
    ensure_has_nbpkg(notebook)
    mkpath(dir)

    readwrite(notebook |> project_file, dir |> project_file)
    readwrite(notebook |> manifest_file, dir |> manifest_file)
end


function write_dir_to_nb(dir::String, notebook::Notebook)
    assert_has_manifest(dir)

    notebook.nbpkg_ctx = Pluto.PkgCompat.create_empty_ctx()

    readwrite(dir |> project_file, notebook |> project_file)
    readwrite(dir |> manifest_file, notebook |> manifest_file)

    save_notebook(notebook)
end

write_dir_to_nb(dir::String, notebook_path::String) = write_dir_to_nb(dir::String, load_notebook(notebook_path))

write_nb_to_dir(notebook_path::String, dir::String) = write_nb_to_dir(load_notebook(notebook_path), dir)
nb_and_dir_environments_equal(notebook_path::String, dir::String) = nb_and_dir_environments_equal(load_notebook(notebook_path), dir)

"""
```julia
reset_notebook_environment(notebook_path::String; keep_project::Bool=false, backup::Bool=true)
```

Remove the embedded `Project.toml` and `Manifest.toml` from a notebook file, modifying the notebook file. If `keep_project` is true, only `Manifest.toml` will be deleted. A backup of the notebook file is created by default.
"""
function reset_notebook_environment(path::String; kwargs...)
    Pluto.reset_nbpkg!(
        load_notebook_nobackup(path);
        kwargs...
    )
end

"""
```julia
update_notebook_environment(notebook_path::String; backup::Bool=true, level::Pkg.UpgradeLevel=Pkg.UPLEVEL_MAJOR)
```

Call `Pkg.update` in the package environment embedded in a notebook file, modifying the notebook file. A [`Pkg.UpgradeLevel`](@ref) can be passed to the `level` keyword argument. A backup file is created by default. 
"""
function update_notebook_environment(path::String; kwargs...)
    session = Pluto.ServerSession()
    notebook = load_notebook_nobackup(path)
    try
        Pluto.update_nbpkg(session, notebook; kwargs...)
    finally
        WorkspaceManager.unmake_workspace((session, notebook))
    end
end

"""
```julia
will_use_pluto_pkg(notebook_path::String)::Bool
```

Will this notebook use the Pluto package manager? `false` means that the notebook contains `Pkg.activate` or another deactivator.
"""
will_use_pluto_pkg(path::String) = will_use_pluto_pkg(load_notebook_nobackup(path))
function will_use_pluto_pkg(notebook::Notebook)
    ctx = notebook.nbpkg_ctx
    # if one of the two files is not empty:
    if ctx !== nothing && !isempty(PkgCompat.read_project_file(ctx)) || !isempty(PkgCompat.read_manifest_file(ctx))
        return true
    end
    
    # otherwise, check for Pkg.activate:
    # when nbpkg_ctx is defined but the files are empty: check if the notebook would use one (i.e. that Pkg.activate is not used).
    topology = Pluto.updated_topology(notebook.topology, notebook, notebook.cells)
    return Pluto.use_plutopkg(topology)
end

"""
```julia
activate_notebook_environment(notebook_path::String; show_help::Bool=true)::Nothing
```

Activate the package environment embedded in a notebook file, for interactive use. This will allow you to use the Pkg REPL and Pkg commands to modify the environment, and any changes you make will be automatically saved in the notebook file.

More help will be displayed if `show_help` is `true`.

Limitations:
- Shut down the notebook before using this functionality.
- Non-interactive use is limited, use the functional form instead, or insert `sleep` calls after modifying the environment.

!!! info
    This functionality works using file watching. A dummy repository contains a copy of the embedded tomls and gets activated, and the notebook file is updated when the dummy repository changes.
"""
function activate_notebook_environment(path::String; show_help::Bool=true)
    notebook_ref = Ref(load_notebook_nobackup(path))

    ensure_has_nbpkg(notebook_ref[])

    ourpath = joinpath(mktempdir(), basename(path))
    mkpath(ourpath)

    still_needed = Ref(true)

    save_token = Token()

    function maybe_update_nb()
        withtoken(save_token) do
            if still_needed[]
                if !nb_and_dir_environments_equal(notebook_ref[], ourpath)
                    write_dir_to_nb(ourpath, notebook_ref[])
                    println()
                    @info "Notebook file updated ✓"
                    println()
                end
            end
        end
    end

    function maybe_update_dir()
        withtoken(save_token) do
            if still_needed[]
                if !nb_and_dir_environments_equal(notebook_ref[], ourpath)
                    write_nb_to_dir(notebook_ref[], ourpath)
                    println()
                    @info "REPL environment updated from notebook ✓"
                    println()
                end
            end
        end
    end

    maybe_update_dir()

    atexit(maybe_update_nb)

    Base.ACTIVE_PROJECT[] = ourpath

    # WATCH DIR PROJECT FILE
    Pluto.@asynclog begin
        while Base.ACTIVE_PROJECT[] == ourpath
            FileWatching.watch_file(ourpath |> project_file)
            # @warn "DIR PROJECT UPDATED"
            sleep(.2)
            
            maybe_update_nb()
        end
        still_needed[] = false
    end

    # WATCH DIR MANIFEST FILE
    Pluto.@asynclog begin
        while Base.ACTIVE_PROJECT[] == ourpath
            FileWatching.watch_file(ourpath |> manifest_file)
            # @warn "DIR MANIFEST UPDATED"
            sleep(.5)
            
            maybe_update_nb()
        end
        still_needed[] = false
    end

    # WATCH NOTEBOOK FILE
    Pluto.@asynclog begin
        while Base.ACTIVE_PROJECT[] == ourpath
            FileWatching.watch_file(path)
            # @warn "NOTEBOOK FILE UPDATED"
            # we update the dir after a longer delay, because changes to the environment in the directory (written to the notebook) take precedence.
            sleep(1)

            notebook_ref[] = load_notebook(path)
            
            maybe_update_dir()
        end
        still_needed[] = false
    end

    # CHECK EVERY 5 SECONDS
    # Pluto.@asynclog begin
    #     while still_needed[]
    #         sleep(5)
    #         maybe_update_nb()
    #         # we update the dir second, because changes to the environment in the directory (written to the notebook) take precedence.
    #         maybe_update_dir()
    #     end
    # end

    if show_help
        println()
        """
        
        > Notebook environment activated!

        ## Step 1.
        _Press `]` to open the Pkg REPL._
        
        The notebook environment is currently active.
        
        ## Step 2. 
        The notebook file and your REPL environment are now synced. This means that:
        1. Any changes you make in the REPL environment will be written to the notebook file. For example, you can `pkg> update` or `pkg> add SomePackage`, and the notebook file will update.
        2. Whenever the notebook file changes, the REPL environment will be updated from the notebook file.

        ## Step 3.
        When you are done, you can exit the notebook environment by deactivating it:

        ```
        pkg> activate
        ```
        """ |> Markdown.parse |> display
        println()
    end
    
    nothing
end



"""
```julia
activate_notebook_environment(f::Function, notebook_path::String)
```

Temporarily activate the package environment embedded in a notebook file, for use inside scripts. Inside your function `f`, you can use Pkg commands to modify the environment, and any changes you make will be automatically saved in the notebook file after your function finishes. Not thread-safe.

This method is best for scripts that update notebook files. For interactive use, the method `activate_notebook_environment(notebook_path::String)` is recommended.

# Example

```julia
Pluto.activate_notebook_environment("notebook.jl") do
    Pkg.add("Example")
end

# Now the file "notebook.jl" was updated!
```

!!! warning
    This function uses the private method `Pkg.activate(f::Function, path::String)`. This API might not be available in future Julia versions. 🤷
"""
function activate_notebook_environment(f::Function, path::String)
    notebook = load_notebook_nobackup(path)
    ensure_has_nbpkg(notebook)
    
    ourpath = joinpath(mktempdir(), basename(path))
    mkpath(ourpath)
    write_nb_to_dir(notebook, ourpath)
    
    result = Pkg.activate(f, ourpath)
    
    if !nb_and_dir_environments_equal(notebook, ourpath)
        write_dir_to_nb(ourpath, notebook)
    end
    
    result
end

const activate_notebook = activate_notebook_environment

function testnb(name="simple_stdlib_import.jl")
    t = tempname()

    readwrite(Pluto.project_relative_path("test", "packages", "fixtures", name), t)
    t
end

end
