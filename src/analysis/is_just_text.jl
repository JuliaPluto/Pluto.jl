const md_and_friends = [
	# Text
	Symbol("@md_str"),
	Symbol("@html_str"),
	:getindex,
]

"""
Does the cell only contain md"..." and html"..."?

This means that these cells can run:
- in "Safe Preview" mode
- server-side (while waiting for the notebook process to start)
"""
function is_just_text(topology::NotebookTopology, cell::Cell)::Bool
	# https://github.com/fonsp/Pluto.jl/issues/209
        node = topology.nodes[cell]
	((isempty(node.definitions) &&
		isempty(node.funcdefs_with_signatures) &&
		node.references ⊆ md_and_friends) ||
	 (length(node.references) == 2 &&
		:PlutoRunner in node.references &&
		Symbol("PlutoRunner.throw_syntax_error") in node.references)) &&
		no_loops(ExpressionExplorerExtras.maybe_macroexpand_pluto(topology.codes[cell].parsedcode; recursive=true))
end

function no_loops(ex::Expr)
	if ex.head  === :while ||
		ex.head === :for ||
		ex.head === :comprehension ||
		ex.head === :generator ||
		ex.head === :try ||
		ex.head === :quote ||
		ex.head === :module
		false
	else
		all(no_loops, ex.args)
	end
end

no_loops(x) = true
