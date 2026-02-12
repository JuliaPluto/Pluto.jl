"""
!!! danger "Danger zone"
	Hello! Nice to see that you are interested in how Pluto works!

	Be careful when using `PlutoRunner` for your project, nothing in this module is public API, and things might suddenly break in a future Pluto version.

	Instead, try to use AbstractPlutoDingetjes.jl and PlutoHooks.jl to achieve your goal – this is our public API.
"""
module PlutoRunner

export @bind

# using these two for two reasons:
# - something related to package loading (original text for 4 years ago: "so that they can be imported from Main on the worker process if it launches without the stdlibs in its LOAD_PATH")
# - static macro expansion (`maybe_macroexpand_pluto`) happens in this module, and expects these to be using-ed.
using Markdown
using InteractiveUtils


# shared things between files:
using UUIDs

# for Pkg.precompile
import Pkg


const ObjectID = typeof(objectid("hello computer"))

struct CachedMacroExpansion
    original_expr_hash::UInt64
    expanded_expr::Expr
    expansion_duration::UInt64
    has_pluto_hook_features::Bool
    did_mention_expansion_time::Bool
    expansion_logs::Vector{Any}
end

const supported_integration_features = Any[]

abstract type SpecialPlutoExprValue end
struct GiveMeCellID <: SpecialPlutoExprValue end
struct GiveMeRerunCellFunction <: SpecialPlutoExprValue end
struct GiveMeRegisterCleanupFunction <: SpecialPlutoExprValue end


# TODO: clear key when a cell is deleted furever
const cell_results = Dict{UUID,Any}()
const cell_runtimes = Dict{UUID,Union{Nothing,UInt64}}()
const cell_published_objects = Dict{UUID,Dict{String,Any}}()
const cell_registered_bond_names = Dict{UUID,Set{Symbol}}()
const cell_expanded_exprs = Dict{UUID,CachedMacroExpansion}()

"""
`PlutoRunner.notebook_id[]` gives you the notebook ID used to identify a session.
"""
const notebook_id = Ref{UUID}(UUID(0))




include("./evaluation/workspace.jl")
include("./evaluation/return.jl")
include("./evaluation/macro.jl")
include("./evaluation/collect_soft_definitions.jl")
include("./evaluation/run_expression.jl")
include("./evaluation/deleting globals.jl")


include("./display/LaTeX.jl")
include("./display/HeaderID.jl")
include("./display/format_output.jl")
include("./display/IOContext.jl")
include("./display/syntax error.jl")
include("./display/Exception.jl")
include("./display/mime dance.jl")
include("./display/tree viewer.jl")


include("./integrations.jl")
include("./ide features/completions.jl")
include("./ide features/docs.jl")
include("./bonds.jl")
include("./js/published_to_js.jl")
include("./display/embed_display.jl")
include("./display/DivElement.jl")

include("./js/jslink.jl")
include("./io/logging.jl")
include("./io/stdout.jl")

function __init__()
    original_stderr[] = stderr
end

end
