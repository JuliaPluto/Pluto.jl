import { combineConfig, Facet, StateField } from "../../imports/CodemirrorPlutoSetup.js"
import { syntaxTree } from "../../imports/CodemirrorPlutoSetup.js"
import { EditorView } from "../../imports/CodemirrorPlutoSetup.js"
import { Decoration } from "../../imports/CodemirrorPlutoSetup.js"

/**
 * ADAPTED MATCH BRACKETS PLUGIN FROM CODEMIRROR
 * Original: https://github.com/codemirror/matchbrackets/blob/99bf6b7e6891c09987269e370dc45ab1d588b875/src/matchbrackets.ts
 *
 * I changed it to ignore the closedBy and openBy properties provided by lezer, because these
 * are all wrong for julia... Also, this supports returning multiple matches, like `if ... elseif ... end`, etc.
 * On top of that I added `match_block` to match the block brackets, like `begin ... end` and all of those.
 * Also it doesn't do non-matching now, there is just matching or nothing.
 */

function match_try_node(node) {
    let try_node = node.parent.firstChild
    let possibly_end = node.parent.lastChild
    let did_match = possibly_end.name === "end"
    if (!did_match) return null

    let catch_node = node.parent.getChild("CatchClause")?.firstChild
    let else_node = node.parent.getChild("TryElseClause")?.firstChild
    let finally_node = node.parent.getChild("FinallyClause")?.firstChild

    return [
        { from: try_node.from, to: try_node.to },
        catch_node && { from: catch_node.from, to: catch_node.to },
        else_node && { from: else_node.from, to: else_node.to },
        finally_node && { from: finally_node.from, to: finally_node.to },
        { from: possibly_end.from, to: possibly_end.to },
    ].filter((x) => x != null)
}

function match_block(node) {
    if (node.name === "end") {
        if (node.parent.name === "IfStatement") {
            // Try moving to the "if" part because
            // the rest of the code is looking for that
            node = node.parent?.firstChild?.firstChild
        } else {
            node = node.parent.firstChild
        }
    }

    if (node == null) {
        return []
    }

    // if (node.name === "StructDefinition") node = node.firstChild
    if (node.name === "mutable" || node.name === "struct") {
        if (node.name === "struct") node = node.parent.firstChild

        let struct_node = node.parent.getChild("struct")
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match || !struct_node) return null

        return [
            { from: node.from, to: struct_node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }
    if (node.name === "struct") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "quote") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "begin") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "do") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "for") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "let") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "macro") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "function") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "while") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "type") node = node.parent.firstChild
    if (node.name === "abstract" || node.name === "primitive") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        let struct_node = node.parent.getChild("type")
        if (!did_match || !struct_node) return null

        return [
            { from: node.from, to: struct_node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    if (node.name === "if" || node.name === "else" || node.name === "elseif") {
        if (node.name === "if") node = node.parent
        let iselse = false
        if (node.name === "else") {
            node = node.parent
            iselse = true
        }
        if (node.name === "elseif") node = node.parent.parent
        if (!node.parent) return null

        let try_node = node.parent.firstChild
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        if (iselse && try_node.name === "try") {
            return match_try_node(node) // try catch else finally end
        }

        let decorations = []
        decorations.push({ from: try_node.from, to: try_node.to })
        for (let elseif_clause_node of node.parent.getChildren("ElseifClause")) {
            let elseif_node = elseif_clause_node.firstChild
            decorations.push({ from: elseif_node.from, to: elseif_node.to })
        }
        for (let else_clause_node of node.parent.getChildren("ElseClause")) {
            let else_node = else_clause_node.firstChild
            decorations.push({ from: else_node.from, to: else_node.to })
        }
        decorations.push({ from: possibly_end.from, to: possibly_end.to })

        return decorations
    }

    if (node.name === "try" || node.name === "catch" || node.name === "finally" || node.name === "else") {
        if (node.name === "catch") node = node.parent
        if (node.name === "finally") node = node.parent
        if (node.name === "else") node = node.parent

        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return match_try_node(node)
    }

    if (node.name === "module" || node.name === "baremodule") {
        let possibly_end = node.parent.lastChild
        let did_match = possibly_end.name === "end"
        if (!did_match) return null

        return [
            { from: node.from, to: node.to },
            { from: possibly_end.from, to: possibly_end.to },
        ]
    }

    return null
}

const baseTheme = EditorView.baseTheme({
    ".cm-matchingBracket": { backgroundColor: "#328c8252" },
    ".cm-nonmatchingBracket": { backgroundColor: "#bb555544" },
})
const DefaultScanDist = 10000,
    DefaultBrackets = "()[]{}"
const bracketMatchingConfig = Facet.define({
    combine(configs) {
        return combineConfig(configs, {
            afterCursor: true,
            brackets: DefaultBrackets,
            maxScanDistance: DefaultScanDist,
        })
    },
})
const matchingMark = Decoration.mark({ class: "cm-matchingBracket" }),
    nonmatchingMark = Decoration.mark({ class: "cm-nonmatchingBracket" })
const bracketMatchingState = StateField.define({
    create() {
        return Decoration.none
    },
    update(deco, tr) {
        if (!tr.docChanged && !tr.selection) return deco
        let decorations = []
        let config = tr.state.facet(bracketMatchingConfig)
        for (let range of tr.state.selection.ranges) {
            if (!range.empty) continue
            let match =
                matchBrackets(tr.state, range.head, -1, config) ||
                (range.head > 0 && matchBrackets(tr.state, range.head - 1, 1, config)) ||
                (config.afterCursor &&
                    (matchBrackets(tr.state, range.head, 1, config) ||
                        (range.head < tr.state.doc.length && matchBrackets(tr.state, range.head + 1, -1, config))))
            if (!match) continue
            let mark = matchingMark
            for (let pos of match) {
                decorations.push(mark.range(pos.from, pos.to))
            }
        }
        return Decoration.set(decorations, true)
    },
    provide: (f) => EditorView.decorations.from(f),
})
const bracketMatchingUnique = [bracketMatchingState, baseTheme]
/// Create an extension that enables bracket matching. Whenever the
/// cursor is next to a bracket, that bracket and the one it matches
/// are highlighted. Or, when no matching bracket is found, another
/// highlighting style is used to indicate this.
export function bracketMatching(config = {}) {
    return [bracketMatchingConfig.of(config), bracketMatchingUnique]
}
/// Find the matching bracket for the token at `pos`, scanning
/// direction `dir`. Only the `brackets` and `maxScanDistance`
/// properties are used from `config`, if given. Returns null if no
/// bracket was found at `pos`, or a match result otherwise.
export function matchBrackets(state, pos, dir, config = {}) {
    let maxScanDistance = config.maxScanDistance || DefaultScanDist,
        brackets = config.brackets || DefaultBrackets
    let tree = syntaxTree(state),
        node = tree.resolveInner(pos, dir)

    let result = match_block(node)
    return result || matchPlainBrackets(state, pos, dir, tree, bracket_node_name_normalizer(node.name), maxScanDistance, brackets)
}

function matchPlainBrackets(state, pos, dir, tree, tokenType, maxScanDistance, brackets) {
    let startCh = dir < 0 ? state.sliceDoc(pos - 1, pos) : state.sliceDoc(pos, pos + 1)
    let bracket = brackets.indexOf(startCh)
    if (bracket < 0 || (bracket % 2 == 0) != dir > 0) return null
    let startToken = { from: dir < 0 ? pos - 1 : pos, to: dir > 0 ? pos + 1 : pos }
    let iter = state.doc.iterRange(pos, dir > 0 ? state.doc.length : 0),
        depth = 0
    for (let distance = 0; !iter.next().done && distance <= maxScanDistance; ) {
        let text = iter.value
        if (dir < 0) distance += text.length
        let basePos = pos + distance * dir
        for (let pos = dir > 0 ? 0 : text.length - 1, end = dir > 0 ? text.length : -1; pos != end; pos += dir) {
            let found = brackets.indexOf(text[pos])
            if (found < 0 || bracket_node_name_normalizer(tree.resolve(basePos + pos, 1).name) != tokenType) continue
            if ((found % 2 == 0) == dir > 0) {
                depth++
            } else if (depth == 1) {
                // Closing
                if (found >> 1 == bracket >> 1) {
                    return [startToken, { from: basePos + pos, to: basePos + pos + 1 }]
                } else {
                    return null
                }
            } else {
                depth--
            }
        }
        if (dir > 0) distance += text.length
    }
    return iter.done ? [startToken] : null
}

/**
 * Little modification to the original matchPlainBrackets function: in our Julia language, the node that opens a bracket is called "(". In e.g. markdown it's called LinkMark or something (the same name for opening and closing). We don't have this so we make them equal.
 */
const bracket_node_name_normalizer = (/** @type {String} */ node_name) => {
    switch (node_name) {
        case "(":
        case ")":
            return "()"
        case "[":
        case "]":
            return "[]"
        case "{":
        case "}":
            return "{}"
        default:
            return node_name
    }
}
