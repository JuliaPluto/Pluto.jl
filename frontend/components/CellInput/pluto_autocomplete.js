import _ from "../../imports/lodash.js"

import { EditorView, EditorState, keymap, autocomplete, syntaxTree, StateField, StateEffect, Transaction } from "../../imports/CodemirrorPlutoSetup.js"
import { get_selected_doc_from_state } from "./LiveDocsFromCursor.js"
import { cl } from "../../common/ClassTable.js"
import { ScopeStateField } from "./scopestate_statefield.js"
import { open_bottom_right_panel } from "../BottomRightPanel.js"
import { ENABLE_CM_AUTOCOMPLETE_ON_TYPE } from "../CellInput.js"
import { GlobalDefinitionsFacet } from "./go_to_definition_plugin.js"
import { STRING_NODE_NAMES } from "./mixedParsers.js"
import { sub_charmap, sup_charmap } from "../../common/UnicodeTools.js"

let { autocompletion, completionKeymap, completionStatus, acceptCompletion, selectedCompletion } = autocomplete

// These should be imported from  @codemirror/autocomplete, but they are not exported.
const completionState = autocompletion()[1]

/** @param {EditorView} cm */
const tab_completion_command = (cm) => {
    // This will return true if the autocomplete select popup is open
    // To test the exception sink, uncomment these lines:
    // if (Math.random() > 0.7) {
    //     throw "LETS CRASH THIS"
    // }
    if (acceptCompletion(cm)) {
        return true
    }
    if (cm.state.readOnly) {
        return false
    }

    let selection = cm.state.selection.main
    if (!selection.empty) return false

    let last_char = cm.state.sliceDoc(selection.from - 1, selection.from)
    let last_line = cm.state.sliceDoc(cm.state.doc.lineAt(selection.from).from, selection.from)

    // Some exceptions for when to trigger tab autocomplete
    if ("\t \n=".includes(last_char)) return false
    // ?([1,2], 3)<TAB> should trigger autocomplete
    if (last_char === ")" && !last_line.includes("?")) return false

    return autocomplete.startCompletion(cm)
}

// Remove this if we find that people actually need the `?` in their queries, but I very much doubt it.
// (Also because the ternary operator does require a space before the ?, thanks Julia!)
let open_docs_if_autocomplete_is_open_command = (cm) => {
    if (autocomplete.completionStatus(cm.state) != null) {
        open_bottom_right_panel("docs")
        return true
    }
    return false
}

const pluto_autocomplete_keymap = [
    { key: "Tab", run: tab_completion_command },
    { key: "?", run: open_docs_if_autocomplete_is_open_command },
]

/**
 * @param {(query: string) => void} on_update_doc_query
 */
let update_docs_from_autocomplete_selection = (on_update_doc_query) => {
    let last_query = null

    return EditorView.updateListener.of((update) => {
        // But we can use `selectedCompletion` to better check if the autocomplete is open
        // (for some reason `autocompletion_state?.open != null` isn't enough anymore?)
        // Sadly we still need `update.state.field(completionState, false)` as well because we can't
        //   apply the result from `selectedCompletion()` yet (has no .from and .to, for example)
        if (selectedCompletion(update.state) == null) return

        let autocompletion_state = update.state.field(completionState, false)
        let open_autocomplete = autocompletion_state?.open
        if (open_autocomplete == null) return

        let selected_option = open_autocomplete.options[open_autocomplete.selected]
        let text_to_apply = selected_option.completion.apply ?? selected_option.completion.label
        if (typeof text_to_apply !== "string") return

        // Option.source is now the source, we find to find the corresponding ActiveResult (internal type)
        const active_result = update.view.state.field(completionState).active.find((a) => a.source == selected_option.source)
        if (active_result?.hasResult?.() !== true) return // not an ActiveResult instance

        const from = active_result.from,
            to = Math.min(active_result.to, update.state.doc.length)

        // Apply completion to state, which will yield us a `Transaction`.
        // The nice thing about this is that we can use the resulting state from the transaction,
        // without updating the actual state of the editor.
        // NOTE This could bite someone who isn't familiar with this, but there isn't an easy way to fix it without a lot of console spam:
        // .... THIS UPDATE WILL DO CONSOLE.LOG'S LIKE ANY UPDATE WOULD DO
        // .... Which means you sometimes get double logs from codemirror extensions...
        // .... Very disorienting 😵‍💫
        let result_transaction = update.state.update({
            changes: {
                from,
                to,
                insert: text_to_apply,
            },
        })

        // So we can use `get_selected_doc_from_state` on our virtual state
        let docs_string = get_selected_doc_from_state(result_transaction.state)
        if (docs_string != null) {
            if (last_query != docs_string) {
                last_query = docs_string
                on_update_doc_query(docs_string)
            }
        }
    })
}

/** Are we matching something like `\lambd...`? */
const match_latex_symbol_complete = (/** @type {autocomplete.CompletionContext} */ ctx) => ctx.matchBefore(/\\[\d\w\!\(\)\+\-\/\:\=\^\_]*/)
/** Are we matching something like `Base.:writing_a_symbo...`? */
const match_operator_symbol_complete = (/** @type {autocomplete.CompletionContext} */ ctx) => ctx.matchBefore(/\.\:[^\s"'`()\[\]\{\}\.\,=]*/)

/** Are we matching inside a string at given pos?
 * @param {EditorState} state
 * @param {number} pos
 * @returns {boolean}
 **/
function match_string_complete(state, pos) {
    const tree = syntaxTree(state)
    const node = tree.resolve(pos)
    if (node == null || !STRING_NODE_NAMES.has(node.name)) {
        return false
    }
    return true
}

let override_text_to_apply_in_field_expression = (text) => {
    return !/^[@\p{L}\p{Sc}\d_][\p{L}\p{Nl}\p{Sc}\d_!]*"?$/u.test(text) ? (text === ":" ? `:(${text})` : `:${text}`) : null
}

const section_regular = {
    name: "Suggestions",
    header: () => document.createElement("div"),
    rank: 0,
}

const section_operators = {
    name: "Operators",
    rank: 1,
}

const field_rank_heuristic = (text, is_exported) => is_exported * 3 + (/^\p{Ll}/u.test(text) ? 2 : /^\p{Lu}/u.test(text) ? 1 : 0)

const julia_commit_characters = (/** @type {autocomplete.CompletionContext} */ ctx) => {
    return ["."]
}
const validFor = (/** @type {string} */ text) => {
    let expected_char = /[\p{L}\p{Nl}\p{Sc}\d_!]*$/u.test(text)

    return expected_char && !endswith_keyword_regex.test(text)
}

const not_explicit_and_too_boring = (/** @type {autocomplete.CompletionContext} */ ctx, allow_strings = false) => {
    if (ctx.explicit) return false
    if (ctx.matchBefore(/[\s=\)+-/,*:'\(;\[\]\{\}"]$/)) return true
    if (ctx.tokenBefore(["IntegerLiteral", "FloatLiteral", "LineComment", "BlockComment", "Symbol"]) != null) return true
    if (!allow_strings) {
        if (ctx.tokenBefore([...STRING_NODE_NAMES]) != null) {
            // don't complete inside a string, unless the user is doing string interpolation.
            if (ctx.matchBefore(/\$[(\p{L}\p{Nl}\p{Sc}\d_!]$/u) == null) {
                return true
            }
        }
    }
    return false
}

/** Use the completion results from the Julia server to create CM completion objects. */
const julia_code_completions_to_cm =
    (/** @type {PlutoRequestAutocomplete} */ request_autocomplete) =>
    /** @returns {Promise<autocomplete.CompletionResult?>} */
    async (/** @type {autocomplete.CompletionContext} */ ctx) => {
        if (match_latex_symbol_complete(ctx)) return null
        if (!ctx.explicit && writing_variable_name_or_keyword(ctx)) return null
        if (not_explicit_and_too_boring(ctx)) return null

        let to_complete_full = /** @type {String} */ (ctx.state.sliceDoc(0, ctx.pos))
        let to_complete = to_complete_full

        // Another rough hack... If it detects a `.:`, we want to cut out the `:` so we get all results from julia,
        // but then codemirror will put the `:` back in filtering
        let is_symbol_completion = match_operator_symbol_complete(ctx)
        if (is_symbol_completion) {
            to_complete = to_complete.slice(0, is_symbol_completion.from + 1) + to_complete.slice(is_symbol_completion.from + 2)
        } else {
            // Generalized logic: send up to and including the last non-variable character
            // (not matching /[\p{L}\p{Nl}\p{Sc}\d_!]/u)
            const match = to_complete.match(/[\p{L}\p{Nl}\p{Sc}\d_!]*$/u)
            if (match && match[0].length < to_complete.length) {
                to_complete = to_complete.slice(0, to_complete.length - match[0].length)
            } else {
                to_complete = ""
            }
        }

        const globals = ctx.state.facet(GlobalDefinitionsFacet)
        const is_already_a_global = (text) => {
            const val = text != null && Object.keys(globals).includes(text)
            // console.log("is_already_a_global", text, val)
            return val
        }

        let found = await request_autocomplete({ query: to_complete, query_full: to_complete_full })

        // console.log("received autocomplete results", { query: to_complete, query_full: to_complete_full }, found)
        if (!found) return null
        let { start, stop, results, too_long } = found

        if (is_symbol_completion) {
            // If this is a symbol completion thing, we need to add the `:` back in by moving the end a bit furher
            stop = stop + 1
        }

        const to_complete_onto = to_complete.slice(0, start)
        const is_field_expression = to_complete_onto.endsWith(".")

        // skip autocomplete's filter if we are completing a ~ path (userexpand)
        const skip_filter = ctx.matchBefore(/\~[^\s\"]*/) != null

        const result = {
            from: start,
            to: ctx.pos,

            // This tells codemirror to not query this function again as long as the string matches the regex.

            // If the number of results was too long, then typing more should re-query (to be able to find results that were cut off)
            validFor: too_long ? undefined : validFor,

            commitCharacters: julia_commit_characters(ctx),
            filter: !skip_filter,

            options: [
                ...results
                    .filter(
                        ([text, _1, _2, is_from_notebook, completion_type]) =>
                            (ctx.explicit || completion_type != "path") && (ctx.explicit || completion_type != "method") && !is_already_a_global(text)
                    )
                    .map(([text, value_type, is_exported, is_from_notebook, completion_type, _ignored], i) => {
                        // (quick) fix for identifiers that need to be escaped
                        // Ideally this is done with Meta.isoperator on the julia side
                        let text_to_apply =
                            completion_type === "method" ? to_complete : is_field_expression ? (override_text_to_apply_in_field_expression(text) ?? text) : text

                        value_type = value_type === "Function" && text.startsWith("@") ? "Macro" : value_type

                        return {
                            label: text,
                            apply: text_to_apply,
                            type:
                                cl({
                                    c_notexported: !is_exported,
                                    [`c_${value_type}`]: true,
                                    [`completion_${completion_type}`]: true,
                                    c_from_notebook: is_from_notebook,
                                }) ?? undefined,
                            section: section_regular,
                            // detail: completion_type,
                            boost:
                                completion_type === "keyword_argument" ? 7 : is_field_expression ? field_rank_heuristic(text_to_apply, is_exported) : undefined,
                            // boost: 50 - i / results.length,
                            commitCharacters: completion_type === "keyword_argument" || value_type === "Macro" ? [] : undefined,
                        }
                    }),
                // This is a small thing that I really want:
                // You want to see what fancy symbols a module has? Pluto will show these at the very end of the list,
                // for Base there is no way you're going to find them! With this you can type `.:` and see all the fancy symbols.
                // TODO This whole block shouldn't use `override_text_to_apply_in_field_expression` but the same
                //      `Meta.isoperator` thing mentioned above
                ...results
                    .filter(([text]) => is_field_expression && override_text_to_apply_in_field_expression(text) != null)
                    .map(([text, value_type, is_exported], i) => {
                        let text_to_apply = override_text_to_apply_in_field_expression(text) ?? ""

                        return {
                            label: text_to_apply,
                            apply: text_to_apply,
                            type: (is_exported ? "" : "c_notexported ") + (value_type == null ? "" : "c_" + value_type),
                            // boost: -99 - i / results.length, // Display below all normal results
                            section: section_operators,
                            // Non-standard
                            is_not_exported: !is_exported,
                        }
                    }),
            ],
        }

        // console.log("cm completion result", result)

        return result
    }

const complete_anyword = async (/** @type {autocomplete.CompletionContext} */ ctx) => {
    if (match_latex_symbol_complete(ctx)) return null
    if (!ctx.explicit && writing_variable_name_or_keyword(ctx)) return null
    if (not_explicit_and_too_boring(ctx)) return null

    const results_from_cm = await autocomplete.completeAnyWord(ctx)
    if (results_from_cm === null) return null

    return {
        from: results_from_cm.from,
        commitCharacters: julia_commit_characters(ctx),

        options: results_from_cm.options.map(({ label }, i) => ({
            // See https://github.com/codemirror/codemirror.next/issues/788 about `type: null`
            label,
            apply: label,
            type: undefined,
            section: section_regular,
            // boost: 0 - i,
        })),
    }
}

const from_notebook_type = "c_from_notebook completion_module c_Any"

/**
 * Are we currently writing a variable name? In that case we don't want autocomplete.
 *
 * E.g. `const hel<TAB>` should not autocomplete.
 */
const writing_variable_name_or_keyword = (/** @type {autocomplete.CompletionContext} */ ctx) => {
    let just_finished_a_keyword = ctx.matchBefore(endswith_keyword_regex)
    if (just_finished_a_keyword) return true

    // Regex explaination:
    // 1. a keyword that could be followed by a variable name like `catch ex` where `ex` is a variable name that should not get completed
    // 2. a space
    // 3. a sequence of either:
    // 3a. a variable name character `@\p{L}\p{Nl}\p{Sc}\d_!`. Also allowed is a bracket or a comma, this is to handle multiple vars `const (a,b)`.
    // 3b. a `, ` comma-space, to treat `const a, b` but not `for a in
    // 4. a `$` to match the end of the line
    let after_keyword = ctx.matchBefore(/(catch|local|module|abstract type|struct|macro|const|for|function|let|do) ([@\p{L}\p{Nl}\p{Sc}\d_!,\(\)]|, )*$/u)
    if (after_keyword) return true

    let inside_do_argument_expression = ctx.matchBefore(/do [\(\), \p{L}\p{Nl}\p{Sc}\d_!]*$/u)
    if (inside_do_argument_expression) return true

    let node = syntaxTree(ctx.state).resolve(ctx.pos, -1)
    let npn = node?.parent?.name
    if (node?.name === "Identifier" && npn === "StructDefinition") return true
    if (node?.name === "Identifier" && npn === "KeywordArguments") return true

    let node2 = npn === "OpenTuple" || npn === "TupleExpression" ? node?.parent : node
    let n2pn = node2?.parent?.name
    let inside_assigment_lhs = node?.name === "Identifier" && (n2pn === "Assignment" || n2pn === "KwArg") && node2?.nextSibling != null

    if (inside_assigment_lhs) return true
    return false
}

const global_variables_completion =
    (/** @type {() => { [uuid: String]: String[]}} */ request_unsubmitted_global_definitions, cell_id) =>
    /** @returns {Promise<autocomplete.CompletionResult?>} */
    async (/** @type {autocomplete.CompletionContext} */ ctx) => {
        if (ctx.matchBefore(/[(\p{L}\p{Nl}\p{Sc}\d_!]$/u) == null) return null
        if (match_latex_symbol_complete(ctx)) return null
        if (!ctx.explicit && writing_variable_name_or_keyword(ctx)) return null
        if (not_explicit_and_too_boring(ctx)) return null

        // see `is_wc_cat_id_start` in Julia's source for a complete list
        const there_is_a_dot_before = ctx.matchBefore(/\.[\p{L}\p{Nl}\p{Sc}\d_!]*$/u)
        if (there_is_a_dot_before) return null

        const globals = ctx.state.facet(GlobalDefinitionsFacet)
        const local_globals = request_unsubmitted_global_definitions()

        const possibles = _.union(
            // Globals that are not redefined locally
            Object.entries(globals)
                .filter(([_, cell_id]) => local_globals[cell_id] == null)
                .map(([name]) => name),
            // Globals that are redefined locally in other cells
            ...Object.values(_.omit(local_globals, cell_id))
        )

        return await make_it_julian(
            autocomplete.completeFromList(
                possibles.map((label) => {
                    return {
                        label,
                        apply: label,
                        type: from_notebook_type,
                        section: section_regular,
                        boost: 1,
                    }
                })
            )
        )(ctx)
    }

/** @returns {autocomplete.CompletionSource} */
const make_it_julian = (/** @type {autocomplete.CompletionSource} */ source) => (/** @type {autocomplete.CompletionContext} */ ctx) => {
    const c = source(ctx)
    if (c instanceof Promise) throw "Oh nooooo"
    return c == null
        ? null
        : {
              ...c,
              validFor,
              commitCharacters: julia_commit_characters(ctx),
          }
}

// Get this list with
// import REPL; REPL.REPLCompletions.sorted_keywords ∪ REPL.REPLCompletions.sorted_keyvals |> repr |> clipboard
export const sorted_keywords = [
    "abstract type",
    "baremodule",
    "begin",
    "break",
    "catch",
    "ccall",
    "const",
    "continue",
    "do",
    "else",
    "elseif",
    "end",
    "export",
    "finally",
    "for",
    "function",
    "global",
    "if",
    "import",
    "let",
    "local",
    "macro",
    "module",
    "mutable struct",
    "primitive type",
    "quote",
    "return",
    "struct",
    "try",
    "using",
    "while",
    "false",
    "true",
]

// Get this list with
// join(map(d -> split(d, " ")[end], REPL.REPLCompletions.sorted_keywords ∪ REPL.REPLCompletions.sorted_keyvals) |> unique |> sort, "|")
const endswith_keyword_regex =
    /^(.*\s)?(baremodule|begin|break|catch|ccall|const|continue|do|else|elseif|end|export|false|finally|for|function|global|if|import|let|local|macro|module|quote|return|struct|true|try|type|using|while)$/

const keyword_completions = sorted_keywords.map((label) => ({
    label,
    apply: label,
    type: "completion_keyword",
    section: section_regular,
}))
const keyword_completions_generator = make_it_julian(autocomplete.completeFromList(keyword_completions))

const complete_keyword = async (/** @type {autocomplete.CompletionContext} */ ctx) => {
    if (
        // require a space or bracket-open before the keyword,
        ctx.matchBefore(/[\s\(\[][a-z]*$/) == null &&
        // or a line start
        ctx.matchBefore(/^[a-z]*$/) == null
    )
        return null
    if (match_latex_symbol_complete(ctx)) return null
    if (!ctx.explicit && writing_variable_name_or_keyword(ctx)) return null
    if (not_explicit_and_too_boring(ctx)) return null
    return await keyword_completions_generator(ctx)
}

const complete_package_name = (/** @type {() => Promise<string[]>} */ request_packages) => {
    let found = null

    const get_packages = async () => {
        if (found == null) {
            const data = await request_packages().catch((e) => {
                console.warn("Failed to fetch packages", e)
                return null
            })
            if (data == null) return null
            found = data.map((name, i) => ({
                label: name,
                apply: name,
                type: "c_package",
            }))
        }
        return found
    }

    return async (/** @type {autocomplete.CompletionContext} */ ctx) => {
        // space before the package name to only find remote packages
        if (ctx.matchBefore(/[ ,][a-zA-Z0-9]+$/) == null) return null
        if (ctx.tokenBefore(["Identifier"]) == null) return null

        const tree = syntaxTree(ctx.state)
        const node = tree.resolve(ctx.pos, -1)
        if (!(node.matchContext(["UsingStatement", "ImportPath"]) || node.matchContext(["ImportStatement", "ImportPath"]))) return null

        const packages = await get_packages()
        return await make_it_julian(autocomplete.completeFromList(packages))(ctx)
    }
}

const local_variables_completion = async (/** @type {autocomplete.CompletionContext} */ ctx) => {
    let scopestate = ctx.state.field(ScopeStateField)
    let identifier = ctx.tokenBefore(["Identifier"])
    if (identifier == null) return null

    let { from, to } = identifier

    const possibles = scopestate.locals
        .filter(({ validity }) => from > validity.from && to <= validity.to)
        .map(({ name }, i) => ({
            // See https://github.com/codemirror/codemirror.next/issues/788 about `type: null`
            label: name,
            apply: name,
            type: undefined,
            boost: 99 - i,
        }))

    return await make_it_julian(autocomplete.completeFromList(possibles))(ctx)
}
const special_latex_examples = ["\\sqrt", "\\pi", "\\approx"]
const special_emoji_examples = ["🐶", "🐱", "🐭", "🐰", "🐼", "🐨", "🐸", "🐔", "🐧"]

/** Apply completion to detail when completion is equal to detail
 * https://codemirror.net/docs/ref/#autocomplete.Completion.apply
 * Example:
 * For latex completions, if inside string only complete to label unless label is already fully typed.
 * \lamb<tab> -> λ
 * "\lamb<tab>" -> "\lambda"
 * "\lambda<tab>" -> "λ"
 * For emojis, we always complete to detail:
 * \:cat:<tab> -> 🐱
 * "\:ca" -> 🐱
 * @param {EditorView} view
 * @param {autocomplete.Completion} completion
 * @param {number} from
 * @param {number} to
 * */
const apply_completion = (view, completion, from, to) => {
    const currentComp = view.state.sliceDoc(from, to)

    let insert = completion.detail ?? completion.label
    const is_emoji = completion.label.startsWith("\\:")
    if (!is_emoji && currentComp !== completion.label) {
        const is_inside_string = match_string_complete(view.state, to)
        if (is_inside_string) {
            insert = completion.label
        }
    }

    view.dispatch({
        ...autocomplete.insertCompletionText(view.state, insert, from, to),
        annotations: autocomplete.pickedCompletion.of(completion),
    })
}

const special_symbols_completion = (/** @type {() => Promise<SpecialSymbols?>} */ request_special_symbols) => {
    let list = null
    const get_list = () => {
        if (list == null) {
            list = request_special_symbols().then((data) => {
                if (data != null) {
                    const { latex, emoji } = data
                    return [emoji, latex].flatMap((map) =>
                        Object.entries(map).map(([label, value]) => {
                            return {
                                label,
                                apply: apply_completion,
                                detail: value ?? undefined,
                                type: "c_special_symbol",
                                boost: label === "\\in" ? 3 : special_latex_examples.includes(label) ? 2 : special_emoji_examples.includes(value) ? 1 : 0,
                            }
                        })
                    )
                }
            })
        }
        return list
    }

    return async (/** @type {autocomplete.CompletionContext} */ ctx) => {
        if (!match_latex_symbol_complete(ctx)) return null
        if (!ctx.explicit && writing_variable_name_or_keyword(ctx)) return null
        if (not_explicit_and_too_boring(ctx, true)) return null
        return await autocomplete.completeFromList((await get_list()) ?? [])(ctx)
    }
}

const superscript_subscript_completion = () => {
    const match_sup = new RegExp(
        `\\\\\\\^([${Object.keys(sup_charmap)
            .map((x) => (x.match(/[\w\d]/) ? x : `\\${x}`))
            .join("")}]{2,})$`
    )
    const match_sub = new RegExp(
        `\\\\\\\_([${Object.keys(sub_charmap)
            .map((x) => (x.match(/[\w\d]/) ? x : `\\${x}`))
            .join("")}]{2,})$`
    )

    return (/** @type {autocomplete.CompletionContext} */ ctx) => {
        const sup_match_result = ctx.matchBefore(match_sup)
        const sub_match_result = ctx.matchBefore(match_sub)

        let match_result = sup_match_result ?? sub_match_result
        let dict = sup_match_result != null ? sup_charmap : sub_charmap

        if (match_result) {
            const { text, from, to } = match_result
            const todo = text.slice(2)
            const result = [...todo].map((char) => dict[char] ?? "").join("")
            return {
                from,
                to,
                filter: false,
                options: [
                    {
                        label: text,
                        apply: apply_completion,
                        detail: result ?? undefined,
                        type: "c_special_symbol",
                        boost: -1,
                    },
                ],
            }
        }
        return null
    }
}

/**
 *
 * @typedef PlutoAutocompleteResult
 * @type {[
 * text: string,
 * value_type: string,
 * is_exported: boolean,
 * is_from_notebook: boolean,
 * completion_type: string,
 * special_symbol: string | null,
 * ]}
 *
 * @typedef PlutoAutocompleteResults
 * @type {{ start: number, stop: number, results: Array<PlutoAutocompleteResult>, too_long: boolean }}
 *
 * @typedef PlutoRequestAutocomplete
 * @type {(options: { query: string, query_full?: string }) => Promise<PlutoAutocompleteResults?>}
 *
 * @typedef SpecialSymbols
 * @type {{emoji: Record<string, string>, latex: Record<string, string>}}
 */

/**
 * @param {object} props
 * @param {PlutoRequestAutocomplete} props.request_autocomplete
 * @param {() => Promise<SpecialSymbols?>} props.request_special_symbols
 * @param {() => Promise<string[]>} props.request_packages
 * @param {(query: string) => void} props.on_update_doc_query
 * @param {() => { [uuid: string] : String[]}} props.request_unsubmitted_global_definitions
 * @param {string} props.cell_id
 */
export let pluto_autocomplete = ({
    request_autocomplete,
    request_special_symbols,
    request_packages,
    on_update_doc_query,
    request_unsubmitted_global_definitions,
    cell_id,
}) => {
    let last_query = null
    let last_result = null
    /**
     * To make stuff a bit easier, we let all the generators fetch all the time and run their logic, but just do one request.
     * Previously I had checks to make sure when `unicode_hint_generator` matches it wouldn't fetch in `julia_code_completions_to_cm`..
     * but that became cumbersome with `expanduser` autocomplete.. also because THERE MIGHT be a case where
     * `~/` actually needs a different completion? Idk, I decided to put this "memoize last" thing here deal with it.
     * @type {PlutoRequestAutocomplete}
     **/
    let memoize_last_request_autocomplete = async (options) => {
        if (_.isEqual(options, last_query)) {
            let result = await last_result
            if (result != null) return result
        }

        last_query = options
        last_result = request_autocomplete(options)
        return await last_result
    }

    /** @type {Promise<SpecialSymbols | null>?} */
    let special_symbols_result = null
    const get_special_symbols_debounced = () => {
        if (special_symbols_result == null) {
            special_symbols_result = request_special_symbols().catch((e) => {
                console.warn("Failed to fetch special symbols", e)
                return null
            })
        }
        return special_symbols_result
    }

    return [
        autocompletion({
            activateOnTyping: ENABLE_CM_AUTOCOMPLETE_ON_TYPE,
            override: [
                global_variables_completion(request_unsubmitted_global_definitions, cell_id),
                special_symbols_completion(get_special_symbols_debounced),
                superscript_subscript_completion(),
                julia_code_completions_to_cm(memoize_last_request_autocomplete),
                complete_keyword,
                complete_package_name(request_packages),
                // complete_anyword,
                local_variables_completion,
            ],
            defaultKeymap: false, // We add these manually later, so we can override them if necessary
            maxRenderedOptions: 512, // fons's magic number
            optionClass: (c) => c.type ?? "",
        }),

        update_docs_from_autocomplete_selection(on_update_doc_query),

        keymap.of(pluto_autocomplete_keymap),
        keymap.of(completionKeymap),
    ]
}
