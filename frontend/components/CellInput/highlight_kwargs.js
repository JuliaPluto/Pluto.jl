// Show keyword arguments in italic.

import { Decoration, EditorView, syntaxTree, ViewPlugin, ViewUpdate } from "../../imports/CodemirrorPlutoSetup.js"

/**
 * @param {EditorView} view
 */
const create_kwarg_decorations = (view) => {
    let widgets = []
    for (let { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node_ref) => {
                if (node_ref.name == "Identifier") {
                    const node = node_ref.node

                    const is_first_child = (/** @type {import("./scopestate_statefield.js").SyntaxNode} */ n) => n.prevSibling == null

                    const is_kwarg = (/** @type {import("./scopestate_statefield.js").SyntaxNode | null} */ n) => {
                        if (!n) return false
                        if (
                            // f(x; NODE)
                            n.matchContext(["KeywordArguments", "Arguments", "CallExpression"].reverse())
                        ) {
                            return true
                        } else if (
                            // f(x; NODE=123)
                            n.matchContext(["KwArg", "KeywordArguments", "Arguments", "CallExpression"].reverse()) ||
                            // f(x, NODE=123)
                            n.matchContext(["KwArg", "Arguments", "CallExpression"].reverse())
                        ) {
                            // is first child?
                            return is_first_child(n)
                        }
                    }

                    /** @type {import("./scopestate_statefield.js").SyntaxNode | null} */
                    let node_to_check = node

                    // NODE::Soething
                    if (node.matchContext(["BinaryExpression"]) && node.node.prevSibling == null) {
                        node_to_check = node.parent
                    }
                    // NODE...
                    if (node.matchContext(["SplatExpression"])) {
                        node_to_check = node.parent
                    }

                    if (is_kwarg(node_to_check)) {
                        const deco = Decoration.mark({
                            class: "cm-julia-kwarg",
                        })
                        widgets.push(deco.range(node.from, node.to))
                    }
                }
            },
        })
    }
    return Decoration.set(widgets)
}

export const highlightKwargsPlugin = () =>
    ViewPlugin.fromClass(
        class {
            updateDecos(view) {
                this.decorations = create_kwarg_decorations(view)
            }

            /**
             * @param {EditorView} view
             */
            constructor(view) {
                this.decorations = Decoration.set([])
                this.updateDecos(view)
            }

            /**
             * @param {ViewUpdate} update
             */
            update(update) {
                if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) != syntaxTree(update.state)) {
                    this.updateDecos(update.view)
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )
