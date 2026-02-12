import { EditorState, syntaxTree } from "../../imports/CodemirrorPlutoSetup.js"
import { sorted_keywords } from "./pluto_autocomplete.js"
import { ScopeStateField } from "./scopestate_statefield.js"

let get_root_variable_from_expression = (cursor) => {
    if (cursor.name === "IndexExpression") {
        cursor.firstChild()
        return get_root_variable_from_expression(cursor)
    }
    if (cursor.name === "FieldExpression") {
        cursor.firstChild()
        return get_root_variable_from_expression(cursor)
    }
    if (cursor.name === "Identifier") {
        cursor.firstChild()
        return cursor.node
    }
    return null
}

let VALID_DOCS_TYPES = [
    "Identifier",
    "Field",
    "FieldExpression",
    "IndexExpression",
    "MacroFieldExpression",
    "MacroIdentifier",
    "Operator",
    "TypeHead",
    "Signature",
    "ParametrizedExpression",
]
let keywords_that_have_docs_and_are_cool = [...sorted_keywords, "."]

let is_docs_searchable = (/** @type {import("../../imports/CodemirrorPlutoSetup.js").TreeCursor} */ cursor) => {
    if (keywords_that_have_docs_and_are_cool.includes(cursor.name)) {
        return true
    } else if (VALID_DOCS_TYPES.includes(cursor.name)) {
        if (cursor.firstChild()) {
            do {
                // Numbers themselves can't be docs searched, but using numbers inside IndexExpression can be.
                if (cursor.name === "IntegerLiteral" || cursor.name === "FloatLiteral") {
                    continue
                }
                // This is for the VERY specific case like `Vector{Int}(1,2,3,4) which I want to yield `Vector{Int}`
                if (cursor.name === "BraceExpression") {
                    continue
                }
                if (cursor.name === "FieldName" || cursor.name === "MacroName" || cursor.name === "MacroFieldName") {
                    continue
                }
                if (!is_docs_searchable(cursor)) {
                    return false
                }
            } while (cursor.nextSibling())
            cursor.parent()
            return true
        } else {
            return true
        }
    } else {
        return false
    }
}

export let get_selected_doc_from_state = (/** @type {EditorState} */ state, verbose = false) => {
    let selection = state.selection.main

    let scopestate = state.field(ScopeStateField)

    if (selection.empty) {
        // If the cell starts with a questionmark, we interpret it as a
        // docs query, so I'm gonna spit out exactly what the user typed.
        let current_line = state.doc.lineAt(selection.from).text
        if (current_line[0] === "?") {
            return current_line.slice(1)
        }

        let tree = syntaxTree(state)
        let cursor = tree.cursor()
        verbose && console.log(`Full tree:`, cursor.toString())
        cursor.moveTo(selection.to, -1)

        let iterations = 0

        do {
            verbose && console.group(`Iteration #${iterations}`)
            try {
                verbose && console.log(`cursor (${cursor.name}):`, cursor.toString())

                // Just to make sure we don't accidentally end up in an infinite loop
                if (iterations > 100) {
                    console.group("Infinite loop while checking docs")
                    console.log("Selection:", selection, state.doc.sliceString(selection.from, selection.to).trim())
                    console.log("Current node:", cursor.name, state.doc.sliceString(cursor.from, cursor.to).trim())
                    console.groupEnd()
                    break
                }
                iterations = iterations + 1

                // Collect parents in a list so I can compare them easily
                let parent_cursor = cursor.node.cursor()
                let parents = []
                while (parent_cursor.parent()) {
                    parents.push(parent_cursor.name)
                }
                // Also just have the first parent as a node
                let parent = cursor.node.parent
                if (parent == null) {
                    break
                }

                verbose && console.log(`parents:`, parents)

                if (sorted_keywords.includes(cursor.name)) {
                    return cursor.toString()
                }

                let index_of_struct_in_parents = parents.indexOf("StructDefinition")
                if (index_of_struct_in_parents !== -1) {
                    verbose && console.log(`in a struct?`)
                    // If we're in a struct, we basically barely want to search the docs:
                    // - Struct name is useless: you are looking at the definition
                    // - Properties are just named, not in the workspace or anything
                    // Only thing we do want, are types and the right hand side of `=`'s.
                    if (parents.includes("binding") && parents.indexOf("binding") < index_of_struct_in_parents) {
                        // We're inside a `... = ...` inside the struct
                    } else if (parents.includes("TypedExpression") && parents.indexOf("TypedExpression") < index_of_struct_in_parents) {
                        // We're inside a `x::X` inside the struct
                    } else if (parents.includes("SubtypedExpression") && parents.indexOf("SubtypedExpression") < index_of_struct_in_parents) {
                        // We're inside `Real` in `struct MyNumber<:Real`
                        while (parent?.name !== "SubtypedExpression") {
                            parent = parent.parent
                        }
                        const type_node = parent.lastChild
                        if (type_node.from <= cursor.from && type_node.to >= cursor.to) {
                            return state.doc.sliceString(type_node.from, type_node.to)
                        }
                    } else if (cursor.name === "struct" || cursor.name === "mutable") {
                        cursor.parent()
                        cursor.firstChild()
                        if (cursor.name === "struct") return "struct"
                        if (cursor.name === "mutable") {
                            cursor.nextSibling()
                            // @ts-ignore
                            if (cursor.name === "struct") return "mutable struct"
                        }
                        return undefined
                    } else {
                        return undefined
                    }
                }

                if (cursor.name === "AbstractDefinition") {
                    return "abstract type"
                }

                // `callee(...)` should yield "callee"
                // (Only if it is on the `(` or `)`, or in like a space,
                //    not on arguments (those are handle later))
                if (cursor.name === "CallExpression") {
                    cursor.firstChild() // Move to callee
                    return is_docs_searchable(cursor) ? state.doc.sliceString(cursor.from, cursor.to) : undefined
                }

                // `Base.:%` should yield... "Base.:%"
                if (
                    (cursor.name === "Operator" || cursor.name === "⚠" || cursor.name === "Identifier") &&
                    parent.name === "QuoteExpression" &&
                    parent.parent?.name === "FieldExpression"
                ) {
                    verbose && console.log("Quirky symbol in a quote expression")
                    // TODO Needs a fix added to is_docs_searchable, but this works fine for now
                    return state.sliceDoc(parent.parent.from, parent.parent.to)
                }

                if (cursor.name === "ParameterizedIdentifier") {
                    cursor.firstChild() // Move to callee
                    return is_docs_searchable(cursor) ? state.doc.sliceString(cursor.from, cursor.to) : undefined
                }

                // `html"asd"` should yield "html"
                if (cursor.name === "Identifier" && parent.name === "Prefix") {
                    continue
                }
                if (cursor.name === "PrefixedString") {
                    cursor.firstChild() // Move to callee
                    let name = state.doc.sliceString(cursor.from, cursor.to)
                    return `${name}"`
                }

                // For identifiers in typed expressions e.g. `a::Number` always show the type
                if (cursor.name === "Identifier" && parent.name === "TypedExpression") {
                    cursor.parent() // Move to TypedExpression
                    cursor.lastChild() // Move to type Identifier
                    return is_docs_searchable(cursor) ? state.doc.sliceString(cursor.from, cursor.to) : undefined
                }
                // For the :: inside a typed expression, show the type
                if (cursor.name === "TypedExpression") {
                    cursor.lastChild() // Move to callee
                    return is_docs_searchable(cursor) ? state.doc.sliceString(cursor.from, cursor.to) : undefined
                }

                // Docs for spread operator when you're in a SpreadExpression
                if (cursor.name === "SpreadExpression") {
                    return "..."
                }

                // For Identifiers, we expand them in the hopes of finding preceding (left side) parts.
                // So we make sure we don't move to the left (`to` stays the same) and then possibly expand
                if (parent.to === cursor.to) {
                    if (VALID_DOCS_TYPES.includes(cursor.name) && VALID_DOCS_TYPES.includes(parent.name)) {
                        verbose && console.log("Expanding identifier")
                        continue
                    }
                }

                // If we are an identifier inside a NamedField, we want to show whatever we are a named part of
                // EXEPT, when we are in the last part (the value) of a NamedField, because then we can show
                // the value.
                if (cursor.name === "Identifier" && parent.name === "NamedField") {
                    if (parent.lastChild.from != cursor.from && parent.lastChild.to != cursor.to) {
                        continue
                    }
                }

                // `a = 1` would yield `=`, `a += 1` would yield `+=`
                if (cursor.name === "binding") {
                    let end_of_first = cursor.node.firstChild.to
                    let beginning_of_last = cursor.node.lastChild.from
                    return state.doc.sliceString(end_of_first, beginning_of_last).trim()
                }

                // If we happen to be in an argumentslist, we should go to the parent
                if (cursor.name === "ArgumentList") {
                    continue
                }
                // If we are on an identifiers inside the argumentslist of a function *declaration*,
                // we should go to the parent.
                if (
                    cursor.name === "Identifier" &&
                    parent.name === "ArgumentList" &&
                    (parent.parent.parent.name === "FunctionAssignmentExpression" || parent.parent.name === "FunctionDefinition")
                ) {
                    continue
                }

                // Identifier that's actually a symbol? Not useful at all!
                if (cursor.name === "Identifier" && parent.name === "Symbol") {
                    continue
                }

                // If we happen to be anywhere else in a function declaration, we want the function name
                // `function X() ... end` to yield `X`
                if (cursor.name === "FunctionDefinition") {
                    cursor.firstChild() // "function"
                    cursor.nextSibling() // Identifier
                    return is_docs_searchable(cursor) ? state.doc.sliceString(cursor.from, cursor.to) : undefined
                }
                // `X() = ...` should yield `X`
                if (cursor.name === "FunctionAssignmentExpression") {
                    cursor.firstChild() // Identifier
                    return is_docs_searchable(cursor) ? state.doc.sliceString(cursor.from, cursor.to) : undefined
                }

                if (cursor.name === "Identifier" && parent.name === "MacroIdentifier") {
                    continue
                }

                // `@X` should yield `X`
                if (cursor.name === "MacroExpression") {
                    cursor.firstChild()
                    return state.doc.sliceString(cursor.from, cursor.to)
                }

                // `1 + 1` should yield `+`
                // A bit odd, but we don't get the span of the actual operator in a binary expression,
                // so we infer it from the end of the left side and start of the right side.
                if (cursor.name === "BinaryExpression") {
                    let end_of_first = cursor.node.firstChild.to
                    let beginning_of_last = cursor.node.lastChild.from
                    return state.doc.sliceString(end_of_first, beginning_of_last).trim()
                }

                // Putting in a special case for ternary expressions (a ? b : c) because I think
                // these might be confusing to new users so I want to extra show them docs about it.
                // Sad thing is, our current docs think that `?:` means "give me info about :", so
                // TODO Make Pluto treat `?` prefixes (or specifically `?:`) as normal identifiers
                if (cursor.name === "TernaryExpression") {
                    return "??:"
                }

                if (VALID_DOCS_TYPES.includes(cursor.name) || keywords_that_have_docs_and_are_cool.includes(cursor.name)) {
                    if (!is_docs_searchable(cursor)) {
                        verbose && console.log("Not searchable aaa")
                        return undefined
                    }

                    // When we can already see that a variable is local, we don't want to show docs for it
                    // because we won't be able to load it in anyway.
                    let root_variable_node = get_root_variable_from_expression(cursor.node.cursor)
                    if (root_variable_node == null) {
                        return state.doc.sliceString(cursor.from, cursor.to)
                    }

                    // We have do find the current usage of the variable, and make sure it has no definition inside this cell
                    let usage = scopestate.usages.find((x) => x.usage.from === root_variable_node.from && x.usage.to === root_variable_node.to)
                    // If we can't find the usage... we just assume it can be docs showed I guess
                    if (usage?.definition == null) {
                        return state.doc.sliceString(cursor.from, cursor.to)
                    }
                }

                // If you get here (so you have no cool other matches) and your parent is a FunctionDefinition,
                // I don't want to show you the function name, so imma head out.
                if (parent.name === "FunctionDefinition") {
                    return undefined
                }
                // If we are expanding to an AssigmentExpression, we DONT want to show `=`
                if (parent.name === "binding") {
                    return undefined
                }
            } finally {
                verbose && console.groupEnd()
            }
        } while (cursor.parent())
    } else {
        return state.doc.sliceString(selection.from, selection.to).trim()
    }
}
