import TOML
import UUIDs: UUID
import .TempDirInScratch

const _notebook_header = "### A Pluto.jl notebook ###"
const _notebook_metadata_prefix = "#> "
# We use a creative delimiter to avoid accidental use in code
# so don't get inspired to suddenly use these in your code!
const _cell_id_delimiter = "# ╔═╡ "
const _cell_metadata_prefix = "# ╠═╡ "
const _order_delimiter = "# ╠═"
const _order_delimiter_folded = "# ╟─"
const _cell_suffix = "\n\n"

const _disabled_prefix = "#=╠═╡\n"
const _disabled_suffix = "\n  ╠═╡ =#"

const _ptoml_cell_id = UUID(1)
const _mtoml_cell_id = UUID(2)


###
# SAVING
###


"""
Save the notebook to `io`, `file` or to `notebook.path`.

In the produced file, cells are not saved in the notebook order. If `notebook.topology` is up-to-date, I will save cells in _topological order_. This guarantees that you can run the notebook file outside of Pluto, with `julia my_notebook.jl`.

Have a look at our [JuliaCon 2020 presentation](https://youtu.be/IAF8DjrQSSk?t=1085) to learn more!
"""
function save_notebook(io::IO, notebook::Notebook)
    println(io, _notebook_header)
    println(io, "# ", PLUTO_VERSION_STR)
    
    # Notebook metadata
    let nb_metadata_toml = strip(sprint(TOML.print, get_metadata_no_default(notebook)))
        if !isempty(nb_metadata_toml)
            println(io)
            for line in split(nb_metadata_toml, "\n")
                println(io, _notebook_metadata_prefix, line)
            end
        end
    end

    # (Anything between the version string and the first UUID delimiter will be ignored by the notebook loader.)
    # We insert these two imports because they are also imported by default in the Pluto session. You might use these packages in your code, so we add the imports to the file, so the file can run as a script.
    println(io, "")
    println(io, "using Markdown")
    println(io, "using InteractiveUtils")
    # Super Advanced Code Analysis™ to add the @bind macro to the saved file if it's used somewhere.
    if any(!must_be_commented_in_file(c) && occursin("@bind", c.code) for c in notebook.cells)
        println(io, "")
        println(io, "# This Pluto notebook uses @bind for interactivity. When running this notebook outside of Pluto, the following 'mock version' of @bind gives bound variables a default value (instead of an error).")
        println(io, PlutoRunner.fake_bind)
    end
    println(io)

    cells_ordered = collect(topological_order(notebook))

    # NOTE: the notebook topological is cached on every update_dependency! call
    # ....  so it is possible that a cell was added/removed since this last update.
    # ....  in this case, it will not contain that cell since it is build from its
    # ....  store notebook topology. therefore, we compute an updated topological
    # ....  order in this unlikely case.
    if length(cells_ordered) != length(notebook.cells_dict)
        cells = notebook.cells
        updated_topo = updated_topology(notebook.topology, notebook, cells)
        cells_ordered = collect(topological_order(updated_topo, cells))
    end

    for c in cells_ordered
        println(io, _cell_id_delimiter, string(c.cell_id))

        let metadata_toml = strip(sprint(TOML.print, get_metadata_no_default(c)))
            if metadata_toml != ""
                for line in split(metadata_toml, "\n")
                    println(io, _cell_metadata_prefix, line)
                end
            end
        end
        
        # Do one little string replacement to make it impossible to use the Pluto cell delimiter inside of actual cell code. If this would happen, then the notebook file cannot load correctly. So we just remove it from your code (sorry!)
        current_code = replace(c.code, _cell_id_delimiter => "# ")

        if must_be_commented_in_file(c)
            print(io, _disabled_prefix)
            print(io, current_code)
            print(io, _disabled_suffix)
            print(io, _cell_suffix)
        else
            # write the cell code and prevent collisions with the cell delimiter
            print(io, current_code)
            print(io, _cell_suffix)
        end
    end


    using_plutopkg = notebook.nbpkg_ctx !== nothing

    write_package = if using_plutopkg
        ptoml_contents = PkgCompat.read_project_file(notebook)
        mtoml_contents = PkgCompat.read_manifest_file(notebook)

        !isempty(strip(ptoml_contents))
    else
        false
    end

    if write_package
        println(io, _cell_id_delimiter, string(_ptoml_cell_id))
        print(io, "PLUTO_PROJECT_TOML_CONTENTS = \"\"\"\n")
        write(io, ptoml_contents)
        print(io, "\"\"\"")
        print(io, _cell_suffix)

        println(io, _cell_id_delimiter, string(_mtoml_cell_id))
        print(io, "PLUTO_MANIFEST_TOML_CONTENTS = \"\"\"\n")
        write(io, mtoml_contents)
        print(io, "\"\"\"")
        print(io, _cell_suffix)
    end

    begin
        println(io, _cell_id_delimiter, "Cell order:")
        for c in notebook.cells
            delim = c.code_folded ? _order_delimiter_folded : _order_delimiter
            println(io, delim, string(c.cell_id))
        end
        if write_package
            println(io, _order_delimiter_folded, string(_ptoml_cell_id))
            println(io, _order_delimiter_folded, string(_mtoml_cell_id))
        end
    end

    notebook
end

# UTILS

function write_buffered(fn::Function, path)
    file_content = sprint(fn)
    write(path, file_content)
end

function save_notebook(notebook::Notebook, path::String)
    # @warn "Saving to file!!" exception=(ErrorException(""), backtrace())
    notebook.last_save_time = time()
    Status.report_business!(notebook.status_tree, :saving) do
        write_buffered(path) do io
            save_notebook(io, notebook)
        end
    end
end

save_notebook(notebook::Notebook) = save_notebook(notebook, notebook.path)


###
# LOADING
###

function _read_notebook_metadata!(@nospecialize(io::IO))
    firstline = String(readline(io))::String

    if firstline != _notebook_header
        error(
            if occursin("<!DOCTYPE", firstline) || occursin("<html", firstline)
                """File is an HTML file, not a notebook file. Open the file directly, and click the "Edit or run" button to get the notebook file."""
            else
                "File is not a Pluto.jl notebook."
            end
        )
    end

    file_VERSION_STR = readline(io)[3:end]
    if file_VERSION_STR != PLUTO_VERSION_STR
        # @info "Loading a notebook saved with Pluto $(file_VERSION_STR). This is Pluto $(PLUTO_VERSION_STR)."
    end

    # Read all remaining file contents before the first cell delimiter.
    header_content = readuntil(io, _cell_id_delimiter)
    header_lines = split(header_content, "\n")

    nb_prefix_length = ncodeunits(_notebook_metadata_prefix)
    nb_metadata_toml_lines = String[
        line[begin+nb_prefix_length:end]
        for line in header_lines if startswith(line, _notebook_metadata_prefix)
    ]

    notebook_metadata = try
        create_notebook_metadata(TOML.parse(join(nb_metadata_toml_lines, "\n")))
    catch e
        @error "Failed to parse embedded TOML content" exception=(e, catch_backtrace())
        DEFAULT_NOTEBOOK_METADATA
    end
    return notebook_metadata
end

function _read_notebook_collected_cells!(@nospecialize(io::IO))
    collected_cells = Dict{UUID,Cell}()
    collected_cells_order = UUID[]
    while !eof(io)
        cell_id_str = String(readline(io))
        if cell_id_str == "Cell order:"
            break
        else
            cell_id = unique_cell_id(cell_id_str, collected_cells)
            metadata_toml_lines = String[]
            initial_code_line = ""
            while !eof(io)
                line = String(readline(io))
                if startswith(line, _cell_metadata_prefix)
                    prefix_length = ncodeunits(_cell_metadata_prefix)
                    push!(metadata_toml_lines, line[begin+prefix_length:end])
                else
                    initial_code_line = line
                    break
                end
            end

            code_raw = initial_code_line * "\n" * String(readuntil(io, _cell_id_delimiter))
            # change Windows line endings to Linux
            code_normalised = replace(code_raw, "\r\n" => "\n")

            # remove the disabled on startup comments for further processing in Julia
            code_normalised = replace(replace(code_normalised, _disabled_prefix => ""), _disabled_suffix => "")

            # remove the cell suffix
            code = code_normalised[1:prevind(code_normalised, end, length(_cell_suffix))]

            # parse metadata
            metadata = try
                create_cell_metadata(TOML.parse(join(metadata_toml_lines, "\n")))
            catch e
                @error "Failed to parse embedded TOML content" cell_id exception=(e, catch_backtrace())
                DEFAULT_CELL_METADATA
            end

            read_cell = Cell(; cell_id, code, metadata)
            collected_cells[cell_id] = read_cell
            push!(collected_cells_order, cell_id)
        end
    end
    return collected_cells, collected_cells_order
end

function unique_cell_id(cell_id_str::String, collected_cells::Dict)
    cell_id_parsed = tryparse(UUID, cell_id_str)
    cell_id = if cell_id_parsed isa UUID
        if haskey(collected_cells, cell_id_parsed)
            @warn "Cell ID appears multiple times in the file. Generating a new one."
            uuid1()
        else
            cell_id_parsed
        end
    else
        uuid1()
    end
end

function _read_notebook_cell_order!(@nospecialize(io::IO), collected_cells)
    cell_order = UUID[]
    while !eof(io)
        cell_id_str = String(readline(io))
        if length(cell_id_str) >= 36 && (startswith(cell_id_str, _order_delimiter_folded) || startswith(cell_id_str, _order_delimiter))
            cell_id = let
                UUID(cell_id_str[end - 35:end])
            end
            next_cell = get(collected_cells, cell_id, nothing)
            if next_cell !== nothing
                next_cell.code_folded = startswith(cell_id_str, _order_delimiter_folded)
            end
            push!(cell_order, cell_id)
        else
            break
        end
    end
    return cell_order
end

function _read_notebook_nbpkg_ctx(cell_order::Vector{UUID}, collected_cells::Dict{Base.UUID, Cell})
    read_package =
        _ptoml_cell_id ∈ cell_order &&
        _mtoml_cell_id ∈ cell_order &&
        haskey(collected_cells, _ptoml_cell_id) &&
        haskey(collected_cells, _mtoml_cell_id)

    nbpkg_ctx = if read_package
        ptoml_code = string(collected_cells[_ptoml_cell_id].code)::String
        mtoml_code = string(collected_cells[_mtoml_cell_id].code)::String

        ptoml_contents = lstrip(split(ptoml_code, "\"\"\"")[2])
        mtoml_contents = lstrip(split(mtoml_code, "\"\"\"")[2])

        env_dir = TempDirInScratch.tempdir()
        write(joinpath(env_dir, "Project.toml"), ptoml_contents)
        write(joinpath(env_dir, "Manifest.toml"), mtoml_contents)

        try
            PkgCompat.load_ctx(env_dir)
        catch e
            @error "Failed to load notebook files: Project.toml+Manifest.toml parse error. Trying to recover Project.toml without Manifest.toml..." exception=(e,catch_backtrace())
            try
                rm(joinpath(env_dir, "Manifest.toml"))
                PkgCompat.load_ctx(env_dir)
            catch e
                @error "Failed to load notebook files: Project.toml parse error." exception=(e,catch_backtrace())
                PkgCompat.create_empty_ctx()
            end
        end
    else
        PkgCompat.create_empty_ctx()
    end
    return nbpkg_ctx
end

function _notebook_appeared_order(cell_order::Vector{UUID}, collected_cells_order::Vector{UUID})
    setdiff!(
        union!(
            # don't include cells that only appear in the order, but no code was given
            intersect(cell_order, collected_cells_order),
            # add cells that appeared in code, but not in the order.
            collected_cells_order
        ),
        # remove Pkg cells
        (_ptoml_cell_id, _mtoml_cell_id)
    )
end

"Load a notebook without saving it or creating a backup; returns a `Notebook`. REMEMBER TO CHANGE THE NOTEBOOK PATH after loading it to prevent it from autosaving and overwriting the original file."
function load_notebook_nobackup(@nospecialize(io::IO), @nospecialize(path::AbstractString); skip_nbpkg::Bool=false)::Notebook
    notebook_metadata = _read_notebook_metadata!(io)
    collected_cells, collected_cells_order = _read_notebook_collected_cells!(io)
    cell_order = _read_notebook_cell_order!(io, collected_cells)
    nbpkg_ctx = skip_nbpkg ? nothing : _read_notebook_nbpkg_ctx(cell_order, collected_cells)

    appeared_order = _notebook_appeared_order(cell_order, collected_cells_order)
    appeared_cells_dict = filter(collected_cells) do (k, v)
        k ∈ appeared_order
    end
    topology = _initial_topology(appeared_cells_dict, appeared_order)
    was_stored_in_executable_order = !isempty(cell_order)

    Notebook(;
        cells_dict=appeared_cells_dict,
        cell_order=appeared_order,
        topology,
        _cached_topological_order=topological_order(topology),
        path,
        nbpkg_ctx,
        nbpkg_installed_versions_cache=nbpkg_cache(nbpkg_ctx),
        metadata=notebook_metadata,
    )
end

# UTILS

function load_notebook_nobackup(path::String; kwargs...)::Notebook
    open(path, "r") do io
        load_notebook_nobackup(io, path; kwargs...)
    end
end

# BACKUPS

"Create a backup of the given file, load the file as a .jl Pluto notebook, save the loaded notebook, compare the two files, and delete the backup of the newly saved file is mostly equal to the backup."
function load_notebook(path::String; disable_writing_notebook_files::Bool=false)::Notebook
    backup_path = backup_filename(path)
    # local backup_num = 1
    # backup_path = path
    # while isfile(backup_path)
    #     backup_path = path * ".backup" * string(backup_num)
    #     backup_num += 1
    # end
    disable_writing_notebook_files || readwrite(path, backup_path)

    loaded = load_notebook_nobackup(path)
    # Analyze cells so that the initial save is in topological order
    loaded.topology = updated_topology(loaded.topology, loaded, loaded.cells) |> static_resolve_topology
    # We update cell dependency on skip_as_script and disabled to avoid removing block comments on the file. See https://github.com/fonsp/Pluto.jl/issues/2182
    update_disabled_cells_dependency!(loaded)
    update_skipped_cells_dependency!(loaded)
    update_dependency_cache!(loaded)

    disable_writing_notebook_files || save_notebook(loaded)
    loaded.topology = NotebookTopology{Cell}(; cell_order=ImmutableVector(loaded.cells))

    disable_writing_notebook_files || if only_versions_or_lineorder_differ(path, backup_path)
        rm(backup_path)
    else
        @warn "Old Pluto notebook might not have loaded correctly. Backup saved to: " backup_path
    end

    loaded
end

_after_first_cell(lines) = lines[something(findfirst(startswith(_cell_id_delimiter), lines), 1):end]

"""
Check if two savefiles are identical, up to their version numbers and a possible line shuffle.

If a notebook has not yet had all of its cells analysed, we can't deduce the topological cell order. (but can we ever??) (no)
"""
function only_versions_or_lineorder_differ(pathA::AbstractString, pathB::AbstractString)::Bool
    Set(readlines(pathA) |> _after_first_cell) == Set(readlines(pathB) |> _after_first_cell)
end

function only_versions_differ(pathA::AbstractString, pathB::AbstractString)::Bool
    readlines(pathA) |> _after_first_cell == readlines(pathB) |> _after_first_cell
end

"Set `notebook.path` to the new value, save the notebook, verify file integrity, and if all OK, delete the old savefile. Normalizes the given path to make it absolute. Moving is always hard. 😢"
function move_notebook!(notebook::Notebook, newpath::String; disable_writing_notebook_files::Bool=false)
    # Will throw exception and return if anything goes wrong, so at least one file is guaranteed to exist.
    oldpath_tame = tamepath(notebook.path)
    newpath_tame = tamepath(newpath)

    if !disable_writing_notebook_files
        save_notebook(notebook, oldpath_tame)
        save_notebook(notebook, newpath_tame)

        # @assert that the new file looks alright
        @assert only_versions_differ(oldpath_tame, newpath_tame)

        notebook.path = newpath_tame

        if oldpath_tame != newpath_tame
            rm(oldpath_tame)
        end
    else
        notebook.path = newpath_tame
    end
    if isdir("$oldpath_tame.assets")
        mv("$oldpath_tame.assets", "$newpath_tame.assets")
    end
    notebook
end
