# The `Notebook` struct!

import UUIDs: UUID, uuid1
import .Configuration
import .PkgCompat: PkgCompat, PkgContext
import Pkg
import .Status

const DEFAULT_NOTEBOOK_METADATA = Dict{String, Any}()

mutable struct BondValue
    value::Any
end
function Base.convert(::Type{BondValue}, dict::AbstractDict)
    BondValue(dict["value"])
end

const ProcessStatus = (
    ready="ready",
    starting="starting",
    no_process="no_process",
    waiting_to_restart="waiting_to_restart",
    waiting_for_permission="waiting_for_permission",
)

"""
A Pluto notebook, yay! 📓

This mutable struct is a notebook session. It contains the information loaded from the `.jl` file, the cell outputs, package information, execution metadata and more.
"""
Base.@kwdef mutable struct Notebook
    "Cells are ordered in a `Notebook`, and this order can be changed by the user. Cells will always have a constant UUID."
    cells_dict::Dict{UUID,Cell}
    cell_order::Vector{UUID}
    # cells::Vector{Cell} – you can also use the `.cells` property to get all cells as a vector. This is defined later using a `Base.getproperty` method.

    path::String
    notebook_id::UUID=uuid1()
    # the reactivity information of this notebook
    topology::NotebookTopology
    
    # caches used to speed up some operations
    _cached_topological_order::TopologicalOrder
    _cached_cell_dependencies::Dict{UUID,Dict{String,Any}}=Dict{UUID,Dict{String,Any}}()
    _cached_cell_dependencies_source::Union{Nothing,NotebookTopology}=nothing

    # buffer will contain all unfetched updates - must be big enough
    # We can keep 1024 updates pending. After this, any put! calls (i.e. calls that push an update to the notebook) will simply block, which is fine.
    # This does mean that the Notebook can't be used if nothing is clearing the update channel.
    pendingupdates::Channel=Channel(1024)

    executetoken::Token=Token()

    # per notebook compiler options
    # nothing means to use global session compiler options
    compiler_options::Union{Nothing,Configuration.CompilerOptions}=nothing
    
    # package environment management
    nbpkg_ctx::Union{Nothing,PkgContext}=nothing # nothing means that the notebook is not (yet) using Pluto's automatic package manager.
    nbpkg_ctx_instantiated::Bool=false
    nbpkg_restart_recommended_msg::Union{Nothing,String}=nothing
    nbpkg_restart_required_msg::Union{Nothing,String}=nothing
    nbpkg_terminal_outputs::Dict{String,String}=Dict{String,String}()
    nbpkg_install_time_ns::Union{Nothing,UInt64}=zero(UInt64)
    nbpkg_busy_packages::Vector{String}=String[]
    nbpkg_installed_versions_cache::Dict{String,String}=Dict{String,String}()

    process_status::String=ProcessStatus.starting
    status_tree::Status.Business=_initial_nb_status()
    wants_to_interrupt::Bool=false
    last_save_time::Float64=time()
    last_hot_reload_time::Float64=zero(time())

    bonds::Dict{Symbol,BondValue}=Dict{Symbol,BondValue}()

    metadata::Dict{String, Any}=copy(DEFAULT_NOTEBOOK_METADATA)
end

function _initial_nb_status()
    b = Status.Business(name=:notebook, started_at=time())
    Status.report_business_planned!(b, :workspace)
    Status.report_business_planned!(b, :pkg)
    Status.report_business_planned!(b, :run)
    return b
end

function _report_business_cells_planned!(notebook::Notebook)
    run_status = Status.report_business_planned!(notebook.status_tree, :run)
    Status.report_business_planned!(run_status, :resolve_topology)
    cell_status = Status.report_business_planned!(run_status, :evaluate)
    for (i,c) in enumerate(notebook.cells)
        c.running = false
        c.queued = true
        Status.report_business_planned!(cell_status, Symbol(i))
    end
end

_collect_cells(cells_dict::Dict{UUID,Cell}, cells_order::Vector{UUID}) = 
    map(i -> cells_dict[i], cells_order)
_initial_topology(cells_dict::Dict{UUID,Cell}, cells_order::Vector{UUID}) =
    NotebookTopology{Cell}(;
        cell_order=ImmutableVector(_collect_cells(cells_dict, cells_order)),
    )

function Notebook(cells::Vector{Cell}, @nospecialize(path::AbstractString), notebook_id::UUID)
    cells_dict=Dict(map(cells) do cell
        (cell.cell_id, cell)
    end)
    cell_order=map(x -> x.cell_id, cells)
    topology = _initial_topology(cells_dict, cell_order)
    Notebook(;
        cells_dict,
        cell_order,
        topology,
        _cached_topological_order=topological_order(topology),
        path,
        notebook_id
    )
end

Notebook(cells::Vector{Cell}, path::AbstractString=numbered_until_new(joinpath(new_notebooks_directory(), cutename()))) = Notebook(cells, path, uuid1())

function Base.getproperty(notebook::Notebook, property::Symbol)
    # This is so that you can do notebook.cells to get all cells as a vector.
    if property == :cells
        _collect_cells(notebook.cells_dict, notebook.cell_order)
    # This is for Firebasey I think
    elseif property == :cell_inputs
        notebook.cells_dict
    else
        getfield(notebook, property)
    end
end

# New method for this function with a `Notebook` as input.
function PlutoDependencyExplorer.topological_order(notebook::Notebook)
    cached = notebook._cached_topological_order
	if cached === nothing || cached.input_topology !== notebook.topology
        notebook._cached_topological_order = topological_order(notebook.topology)
	else
		cached
	end
end

emptynotebook(args...) = Notebook([Cell()], args...)

function sample_notebook(name::String)
    file = project_relative_path("sample", name * ".jl")
    nb = load_notebook_nobackup(file)
    nb.path = tempname() * ".jl"
    nb
end

create_cell_metadata(metadata::Dict{String,<:Any}) = merge(DEFAULT_CELL_METADATA, metadata)
create_notebook_metadata(metadata::Dict{String,<:Any}) = merge(DEFAULT_NOTEBOOK_METADATA, metadata)
get_metadata(cell::Cell)::Dict{String,Any} = cell.metadata
get_metadata(notebook::Notebook)::Dict{String,Any} = notebook.metadata
get_metadata_no_default(cell::Cell)::Dict{String,Any} = Dict{String,Any}(setdiff(pairs(cell.metadata), pairs(DEFAULT_CELL_METADATA)))
get_metadata_no_default(notebook::Notebook)::Dict{String,Any} = Dict{String,Any}(setdiff(pairs(notebook.metadata), pairs(DEFAULT_NOTEBOOK_METADATA)))
