import { syntaxTree, StateField, NodeWeakMap, Text } from "../../imports/CodemirrorPlutoSetup.js"
import _ from "../../imports/lodash.js"

const VERBOSE = false

/**
 * @typedef TreeCursor
 * @type {import("../../imports/CodemirrorPlutoSetup.js").TreeCursor}
 */

/**
 * @typedef SyntaxNode
 * @type {TreeCursor["node"]}
 */

/**
 * @typedef Range
 * @property {number} from
 * @property {number} to
 *
 * @typedef {Range & {valid_from: number}} Definition
 *
 * @typedef ScopeState
 * @property {Array<{
 *  usage: Range,
 *  definition: Range | null,
 *  name: string,
 * }>} usages Any variable use, global or local.
 * @property {Map<String, Definition>} definitions All global variable definitions.
 * @property {Array<{ definition: Range, validity: Range, name: string }>} locals All local variable definitions, with the range where they are valid.
 */

const r = (cursor) => ({ from: cursor.from, to: cursor.to })

const find_local_definition = (locals, name, cursor) => {
    for (let lo of locals) {
        if (lo.name === name && cursor.from >= lo.validity.from && cursor.to <= lo.validity.to) {
            return lo
        }
    }
}

const HardScopeNames = new Set([
    "WhileStatement",
    "ForStatement",
    "TryStatement",
    "LetStatement",
    "FunctionDefinition",
    "MacroDefinition",
    "DoClause",
    "Generator",
])

const does_this_create_scope = (/** @type {TreeCursor} */ cursor) => {
    if (HardScopeNames.has(cursor.name)) return true

    if (cursor.name === "Assignment") {
        const reset = cursor.firstChild()
        try {
            // f(x) = x
            // @ts-ignore
            if (cursor.name === "CallExpression") return true
        } finally {
            if (reset) cursor.parent()
        }
    }

    return false
}

/**
 * Look into the left-hand side of an Assigment expression and find all ranges where variables are defined.
 * E.g. `a, (b,c) = something` will return ranges for a, b, c.
 * @param {TreeCursor} root_cursor
 * @returns {Range[]}
 */
const explore_assignment_lhs = (root_cursor) => {
    const a = cursor_not_moved_checker(root_cursor)
    let found = []
    root_cursor.iterate((cursor) => {
        if (cursor.name === "Identifier" || cursor.name === "MacroIdentifier" || cursor.name === "Operator") {
            found.push(r(cursor))
        }
        if (cursor.name === "IndexExpression" || cursor.name === "FieldExpression") {
            // not defining a variable but modifying an object
            return false
        }
    })
    a()
    return found
}

/**
 * Remember the position where this is called, and return a function that will move into parents until we are are back at that position.
 *
 * You can use this before exploring children of a cursor, and then go back when you are done.
 */
const back_to_parent_resetter = (/** @type {TreeCursor} */ cursor) => {
    const map = new NodeWeakMap()
    map.cursorSet(cursor, "here")
    return () => {
        while (map.cursorGet(cursor) !== "here") {
            if (!cursor.parent()) throw new Error("Could not find my back to the original parent!")
        }
    }
}

const cursor_not_moved_checker = (cursor) => {
    const map = new NodeWeakMap()
    map.cursorSet(cursor, "yay")

    const debug = (cursor) => `${cursor.name}(${cursor.from},${cursor.to})`

    const debug_before = debug(cursor)

    return () => {
        if (map.cursorGet(cursor) !== "yay") {
            throw new Error(`Cursor changed position when forbidden! Before: ${debug_before}, after: ${debug(cursor)}`)
        }
    }
}

/** Return the number of siblings that appear before the cursor (i.e. the index of the cursor node among its siblings, starting at 0), and the name of the parent node. */
const parent_name_and_child_index = (cursor) => {
    const map = new NodeWeakMap()
    map.cursorSet(cursor, "here")
    if (!cursor.parent()) return { parent_name: null, index: -1 }
    const parent_name = cursor.name
    if (!cursor.firstChild()) throw new Error("Could not find my way back")
    let index = 0
    while (map.cursorGet(cursor) !== "here") {
        index++
        if (!cursor.nextSibling()) {
            throw new Error("Could not find my way back")
        }
    }
    return { parent_name, index }
}

/**
 * Extract defined variable names from an import/using statement.
 * @param {TreeCursor} cursor
 * @param {Text} doc
 * @returns {Range[]}
 */
const explore_import_statement = (cursor, doc) => {
    const a = cursor_not_moved_checker(cursor)
    let found = []

    // Get the last identifier in an ImportPath
    const get_last_identifier_in_import_path = (cursor) => {
        // ImportPath contains: dots, Identifiers separated by dots
        // We want the last Identifier
        let lastIdentifier = null
        if (cursor.firstChild()) {
            do {
                if (cursor.name === "Identifier") {
                    lastIdentifier = r(cursor)
                }
            } while (cursor.nextSibling())
            cursor.parent()
        }
        return lastIdentifier
    }

    if (cursor.firstChild()) {
        // Skip the 'import' or 'using' keyword
        while (cursor.nextSibling()) {
            if (cursor.name === "SelectedImport") {
                // `import Pluto: wow, bar` or `using Pluto: wow, bar`
                // Only items after `:` define variables
                let sawColon = false
                if (cursor.firstChild()) {
                    do {
                        // @ts-ignore
                        if (cursor.name === ":") {
                            sawColon = true
                            // @ts-ignore
                        } else if (sawColon && cursor.name === "ImportPath") {
                            const id = get_last_identifier_in_import_path(cursor)
                            if (id) found.push(id)
                        }
                    } while (cursor.nextSibling())
                    cursor.parent()
                }
            } else if (cursor.name === "ImportPath") {
                // `import Pluto` or `import Pluto.wow`
                // The last identifier is the defined variable
                const id = get_last_identifier_in_import_path(cursor)
                if (id) found.push(id)
            }
        }
        cursor.parent()
    }

    a()
    return found
}

/**
 * @param {TreeCursor} cursor
 * @returns {Range[]}
 */
const explore_funcdef_arguments = (cursor, { enter, leave }) => {
    VERBOSE && console.assert(cursor.name === "TupleExpression" || cursor.name === "Arguments", cursor.name)

    let found = []

    const position_validation = cursor_not_moved_checker(cursor)
    const position_resetter = back_to_parent_resetter(cursor)

    if (!cursor.firstChild()) throw new Error(`Expected to go into function definition argument expression, stuck at ${cursor.name}`)
    // should be in the TupleExpression now

    cursor.firstChild()

    const explore_argument = () => {
        if (cursor.name === "Identifier" || cursor.name === "Operator") {
            found.push(r(cursor))
        } else if (cursor.name === "KwArg") {
            let went_in = cursor.firstChild()
            explore_argument()
            cursor.nextSibling()
            // find stuff used here
            cursor.iterate(enter, leave)

            if (went_in) cursor.parent()
        } else if (cursor.name === "BinaryExpression") {
            let went_in = cursor.firstChild()
            explore_argument()
            cursor.nextSibling()
            cursor.nextSibling()
            // find stuff used here
            cursor.iterate(enter, leave)

            if (went_in) cursor.parent()
        }
    }

    do {
        if (cursor.name === "KeywordArguments") {
            cursor.firstChild() // go into kwarg arguments
        }
        explore_argument()
    } while (cursor.nextSibling())

    position_resetter()
    position_validation()

    VERBOSE && console.log({ found })
    return found
}

/**
 * @param {TreeCursor | SyntaxNode} tree
 * @param {Text} doc
 * @param {any} _scopestate
 * @param {boolean} [verbose]
 * @returns {ScopeState}
 */
export let explore_variable_usage = (tree, doc, _scopestate, verbose = VERBOSE) => {
    if ("cursor" in tree) {
        console.trace("`explore_variable_usage()` called with a SyntaxNode, not a TreeCursor")
        tree = tree.cursor()
    }

    const scopestate = {
        usages: [],
        definitions: new Map(),
        locals: [],
    }

    let local_scope_stack = /** @type {Range[]} */ ([])

    const definitions = /** @type {Map<string, Definition>} */ new Map()
    const locals = /** @type {Array<{ definition: Range, validity: Range, name: string }>} */ ([])
    const usages = /** @type {Array<{ usage: Range, definition: Range | null, name: string }>} */ ([])

    const return_false_immediately = new NodeWeakMap()

    let enter, leave

    enter = (/** @type {TreeCursor} */ cursor) => {
        if (verbose) {
            console.group(`Explorer: ${cursor.name}`)

            console.groupCollapsed("Details")
            try {
                console.log(`Full tree: ${cursor.toString()}`)
                console.log("Full text:", doc.sliceString(cursor.from, cursor.to))
                console.log(`scopestate:`, scopestate)
            } finally {
                console.groupEnd()
            }
        }

        if (
            return_false_immediately.cursorGet(cursor) ||
            cursor.name === "ModuleDefinition" ||
            cursor.name === "QuoteStatement" ||
            cursor.name === "QuoteExpression" ||
            cursor.name === "MacroIdentifier" ||
            cursor.name === "Symbol"
        ) {
            if (verbose) console.groupEnd()
            return false
        }

        // Handle import/using statements - they always define global variables, regardless of local scope
        if (cursor.name === "ImportStatement" || cursor.name === "UsingStatement") {
            explore_import_statement(cursor, doc).forEach((range) => {
                const name = doc.sliceString(range.from, range.to)
                definitions.set(name, { ...range, valid_from: range.from })
            })
            if (verbose) console.groupEnd()
            return false
        }

        const register_variable = (range) => {
            const name = doc.sliceString(range.from, range.to)

            if (local_scope_stack.length === 0)
                definitions.set(name, {
                    ...range,
                    valid_from: range.from,
                })
            else locals.push({ name, validity: /** @type{Range} */ (_.last(local_scope_stack)), definition: range })
        }

        if (does_this_create_scope(cursor)) {
            local_scope_stack.push(r(cursor))
        }

        if (cursor.name === "Identifier" || cursor.name === "MacroIdentifier" || cursor.name === "Operator") {
            if (cursor.matchContext(["KwArg"])) {
                const { parent_name, index } = parent_name_and_child_index(cursor)
                if (parent_name === "KwArg" && index === 0) {
                    if (verbose) console.groupEnd()
                    return false
                }
            }
            const name = doc.sliceString(cursor.from, cursor.to)
            usages.push({
                name: name,
                usage: {
                    from: cursor.from,
                    to: cursor.to,
                },
                definition: find_local_definition(locals, name, cursor) ?? null,
            })
        } else if (cursor.name === "Assignment" || cursor.name === "ForBinding" || cursor.name === "CatchClause") {
            if (cursor.firstChild()) {
                // @ts-ignore
                if (cursor.name === "catch") cursor.nextSibling()
                // CallExpression means function definition `f(x) = x`, this is handled elsewhere
                // @ts-ignore
                if (cursor.name !== "CallExpression") {
                    explore_assignment_lhs(cursor).forEach(register_variable)
                    // mark this one as finished
                    return_false_immediately.cursorSet(cursor, true)
                }
                cursor.parent()
            }
        } else if (cursor.name === "Parameters") {
            explore_assignment_lhs(cursor).forEach(register_variable)
            if (verbose) console.groupEnd()
            return false
        } else if (cursor.name === "Field") {
            if (verbose) console.groupEnd()
            return false
        } else if (cursor.name === "CallExpression") {
            if (
                cursor.matchContext(["FunctionDefinition", "Signature"]) ||
                (cursor.matchContext(["Assignment"]) && parent_name_and_child_index(cursor).index === 0)
            ) {
                const pos_resetter = back_to_parent_resetter(cursor)

                cursor.firstChild() // Now we should have the function name
                // @ts-ignore
                if (cursor.name === "Identifier" || cursor.name === "Operator" || cursor.name === "FieldExpression") {
                    if (verbose) console.log("found function name", doc.sliceString(cursor.from, cursor.to), cursor.name)

                    const last_scoper = local_scope_stack.pop()
                    register_variable(r(cursor))
                    if (last_scoper) local_scope_stack.push(last_scoper)

                    cursor.nextSibling()
                }
                if (verbose) console.log("expl funcdef ", doc.sliceString(cursor.from, cursor.to))
                explore_funcdef_arguments(cursor, { enter, leave }).forEach(register_variable)
                if (verbose) console.log("expl funcdef ", doc.sliceString(cursor.from, cursor.to))

                pos_resetter()

                if (verbose) console.log("end of FunctionDefinition, currently at ", cursor.node)

                if (verbose) console.groupEnd()
                return false
            }
        } else if (cursor.name === "Generator") {
            // This is: (f(x) for x in xs) or [f(x) for x in xs]
            const savior = back_to_parent_resetter(cursor)

            // We do a Generator in two steps:
            // First we explore all the ForBindings (where locals get defined), and then we go into the first child (where those locals are used).

            // 1. The for bindings `x in xs`
            if (cursor.firstChild()) {
                // Note that we skip the first child here, which is what we want! That's the iterated expression that we leave for the end.
                while (cursor.nextSibling()) {
                    cursor.iterate(enter, leave)
                }
                savior()
            }
            // 2. The iterated expression `f(x)`
            if (cursor.firstChild()) {
                cursor.iterate(enter, leave)
                savior()
            }

            // k thx byeee
            leave(cursor)
            return false
        }
    }

    leave = (/** @type {TreeCursor} */ cursor) => {
        if (verbose) {
            console.groupEnd()
        }

        if (does_this_create_scope(cursor)) {
            local_scope_stack.pop()
        }
    }

    const debugged_enter = (cursor) => {
        const a = cursor_not_moved_checker(cursor)
        const result = enter(cursor)
        a()
        return result
    }

    tree.iterate(verbose ? debugged_enter : enter, leave)

    if (local_scope_stack.length > 0) throw new Error(`Some scopes were not leaved... ${JSON.stringify(local_scope_stack)}`)

    const output = { usages, definitions, locals }
    if (verbose) console.log(output)
    return output
}

/**
 * @type {StateField<ScopeState>}
 */
export let ScopeStateField = StateField.define({
    create(state) {
        try {
            let cursor = syntaxTree(state).cursor()
            let scopestate = explore_variable_usage(cursor, state.doc, undefined)
            return scopestate
        } catch (error) {
            console.error("Something went wrong while parsing variables...", error)
            return {
                usages: [],
                definitions: new Map(),
                locals: [],
            }
        }
    },

    update(value, tr) {
        try {
            if (syntaxTree(tr.state) != syntaxTree(tr.startState)) {
                let cursor = syntaxTree(tr.state).cursor()
                let scopestate = explore_variable_usage(cursor, tr.state.doc, null)
                return scopestate
            } else {
                return value
            }
        } catch (error) {
            console.error("Something went wrong while parsing variables...", error)
            return {
                usages: [],
                definitions: new Map(),
                locals: [],
            }
        }
    },
})
