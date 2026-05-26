module MoreAnalysis

export bound_variable_connections_graph

import ..Pluto
import ..Pluto: Cell, Notebook, NotebookTopology, ExpressionExplorer, ExpressionExplorerExtras, PlutoDependencyExplorer
import PlutoDependencyExplorer: all_cells


"Return whether any cell references the given symbol. Used for the @bind mechanism."
function is_referenced_anywhere(topology::NotebookTopology, sym::Symbol)::Bool
	any(all_cells(topology)) do cell
		sym ∈ topology.nodes[cell].references
	end
end

"Return whether any cell defines the given symbol. Used for the @bind mechanism."
function is_assigned_anywhere(topology::NotebookTopology, sym::Symbol)::Bool
	any(all_cells(topology)) do cell
		sym ∈ topology.nodes[cell].definitions
	end
end


"Find all subexpressions of the form `@bind symbol something`, and extract the `symbol`s."
function find_bound_variables(expr)
	found = Set{Symbol}()
	_find_bound_variables!(found, ExpressionExplorerExtras.maybe_macroexpand_pluto(expr; recursive=true, expand_bind=false))
	found
end

function _find_bound_variables!(found::Set{Symbol}, expr::Expr)
	if expr.head === :macrocall && expr.args[1] === Symbol("@bind") && length(expr.args) == 4 && expr.args[3] isa Symbol
		push!(found, expr.args[3])
		_find_bound_variables!(found, expr.args[4])
    elseif expr.args === :quote
        found
    else
		for a in expr.args
			_find_bound_variables!(found, a)
		end
	end
end

function _find_bound_variables!(found::Set{Symbol}, expr::Any) end




"Return the given cells, and all cells that depend on them (recursively)."
function downstream_recursive(
    topology::NotebookTopology,
    from::Union{Vector{Cell},Set{Cell}},
)::Set{Cell}
    found = Set{Cell}(empty(from))
    _downstream_recursive!(found, topology, from)
    found
end

function _downstream_recursive!(
    found::Set{Cell},
    topology::NotebookTopology,
    from::Vector{Cell},
)::Nothing
    for cell in from
        one_down = PlutoDependencyExplorer.where_referenced(topology, cell)
        for next in one_down
            if next ∉ found
                push!(found, next)
                _downstream_recursive!(found, topology, Cell[next])
            end
        end
    end
end




"Return all cells that are depended upon by any of the given cells."
function upstream_recursive(
    topology::NotebookTopology,
    from::Union{Vector{Cell},Set{Cell}},
)::Set{Cell}
    found = Set{Cell}(empty(from))
    _upstream_recursive!(found, topology, from)
    found
end

function _upstream_recursive!(
    found::Set{Cell},
    topology::NotebookTopology,
    from::Vector{Cell},
)::Nothing
    for cell in from
        references = topology.nodes[cell].references
        for upstream in PlutoDependencyExplorer.where_assigned(topology, references)
            if upstream ∉ found
                push!(found, upstream)
                _upstream_recursive!(found, topology, Cell[upstream])
            end
        end
    end
end

"All cells that can affect the outcome of changing the given variable."
function codependents(topology::NotebookTopology, var::Symbol)::Set{Cell}
    assigned_in = filter(all_cells(topology)) do cell
        var ∈ topology.nodes[cell].definitions
    end
    
    downstream = collect(union!(downstream_recursive(topology, assigned_in), assigned_in))

    downupstream = union!(upstream_recursive(topology, downstream), assigned_in)
end

"Return a `Dict{Symbol,Vector{Symbol}}` where the _keys_ are the bound variables of the notebook.

For each key (a bound symbol), the value is the list of (other) bound variables whose values need to be known to compute the result of setting the bond."
function bound_variable_connections_graph(topology::NotebookTopology)::Dict{Symbol,Vector{Symbol}}
    bound_variables = union(map(all_cells(topology)) do cell
        find_bound_variables(topology.codes[cell].parsedcode)
    end...)
    Dict{Symbol,Vector{Symbol}}(
        var => let
            cells = codependents(topology, var)
            defined_there = union!(Set{Symbol}(), (topology.nodes[c].definitions for c in cells)...)
            # Set([var]) ∪ 
            collect((defined_there ∩ bound_variables))
        end
        for var in bound_variables
    )
end

end
