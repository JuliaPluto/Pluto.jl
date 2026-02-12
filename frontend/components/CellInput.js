import { html, useState, useEffect, useLayoutEffect, useRef, useContext, useMemo } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

import { utf8index_to_ut16index } from "../common/UnicodeTools.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { get_selected_doc_from_state } from "./CellInput/LiveDocsFromCursor.js"
import { go_to_definition_plugin, GlobalDefinitionsFacet } from "./CellInput/go_to_definition_plugin.js"
// import { debug_syntax_plugin } from "./CellInput/debug_syntax_plugin.js"

import {
    EditorState,
    EditorSelection,
    Compartment,
    EditorView,
    placeholder,
    keymap,
    history,
    historyKeymap,
    defaultKeymap,
    indentMore,
    indentLess,
    tags,
    HighlightStyle,
    lineNumbers,
    highlightSpecialChars,
    drawSelection,
    indentOnInput,
    closeBrackets,
    rectangularSelection,
    highlightSelectionMatches,
    closeBracketsKeymap,
    foldKeymap,
    indentUnit,
    autocomplete,
    htmlLanguage,
    markdownLanguage,
    javascriptLanguage,
    pythonLanguage,
    syntaxHighlighting,
    cssLanguage,
    setDiagnostics,
    moveLineUp,
    Facet,
} from "../imports/CodemirrorPlutoSetup.js"

import { markdown, html as htmlLang, javascript, sqlLang, python, julia_mixed } from "./CellInput/mixedParsers.js"
import { julia } from "../imports/CodemirrorPlutoSetup.js"
import { pluto_autocomplete } from "./CellInput/pluto_autocomplete.js"
import { NotebookpackagesFacet, pkgBubblePlugin } from "./CellInput/pkg_bubble_plugin.js"
import { awesome_line_wrapping, get_start_tabs } from "./CellInput/awesome_line_wrapping.js"
import { cell_movement_plugin, prevent_holding_a_key_from_doing_things_across_cells } from "./CellInput/cell_movement_plugin.js"
import { pluto_paste_plugin } from "./CellInput/pluto_paste_plugin.js"
import { bracketMatching } from "./CellInput/block_matcher_plugin.js"
import { cl } from "../common/ClassTable.js"
import { HighlightLineFacet, HighlightRangeFacet, highlightLinePlugin, highlightRangePlugin } from "./CellInput/highlight_line.js"
import { commentKeymap } from "./CellInput/comment_mixed_parsers.js"
import { ScopeStateField } from "./CellInput/scopestate_statefield.js"
import { mod_d_command } from "./CellInput/mod_d_command.js"
import { open_bottom_right_panel } from "./BottomRightPanel.js"
import { timeout_promise } from "../common/PlutoConnection.js"
import { LastFocusWasForcedEffect, tab_help_plugin } from "./CellInput/tab_help_plugin.js"
import { useEventListener } from "../common/useEventListener.js"
import { moveLineDown } from "../imports/CodemirrorPlutoSetup.js"
import { open_pluto_popup } from "../common/open_pluto_popup.js"
import { AIContext } from "./AIContext.js"
import { AiSuggestionPlugin } from "./CellInput/ai_suggestion.js"
import { t } from "../common/lang.js"

export const ENABLE_CM_MIXED_PARSER = window.localStorage.getItem("ENABLE_CM_MIXED_PARSER") === "true"
export const ENABLE_CM_SPELLCHECK = window.localStorage.getItem("ENABLE_CM_SPELLCHECK") === "true"
export const ENABLE_CM_AUTOCOMPLETE_ON_TYPE = (window.localStorage.getItem("ENABLE_CM_AUTOCOMPLETE_ON_TYPE") ?? "true") === "true"

if (ENABLE_CM_MIXED_PARSER) {
    console.log(`YOU ENABLED THE CODEMIRROR MIXED LANGUAGE PARSER
Thanks! Awesome!
Please let us know if you find any bugs...
If enough people do this, we can make it the default parser.
`)
}

// Added this so we can have people test the mixed parser, because I LIKE IT SO MUCH - DRAL
// @ts-ignore
window.PLUTO_TOGGLE_CM_MIXED_PARSER = (val = !ENABLE_CM_MIXED_PARSER) => {
    window.localStorage.setItem("ENABLE_CM_MIXED_PARSER", String(val))
    window.location.reload()
}

// @ts-ignore
window.PLUTO_TOGGLE_CM_SPELLCHECK = (val = !ENABLE_CM_SPELLCHECK) => {
    window.localStorage.setItem("ENABLE_CM_SPELLCHECK", String(val))
    window.location.reload()
}

// @ts-ignore
window.PLUTO_TOGGLE_CM_AUTOCOMPLETE_ON_TYPE = (val = !ENABLE_CM_AUTOCOMPLETE_ON_TYPE) => {
    window.localStorage.setItem("ENABLE_CM_AUTOCOMPLETE_ON_TYPE", String(val))
    window.location.reload()
}

const common_style_tags = [
    { tag: tags.comment, color: "var(--cm-color-comment)", fontStyle: "italic", filter: "none" },
    { tag: tags.variableName, color: "var(--cm-color-variable)", fontWeight: 700 },
    { tag: tags.propertyName, color: "var(--cm-color-symbol)", fontWeight: 700 },
    { tag: tags.macroName, color: "var(--cm-color-macro)", fontWeight: 700 },
    { tag: tags.typeName, filter: "var(--cm-filter-type)", fontWeight: "lighter" },
    { tag: tags.atom, color: "var(--cm-color-symbol)" },
    { tag: tags.string, color: "var(--cm-color-string)" },
    { tag: tags.special(tags.string), color: "var(--cm-color-command)" },
    { tag: tags.character, color: "var(--cm-color-literal)" },
    { tag: tags.literal, color: "var(--cm-color-literal)" },
    { tag: tags.keyword, color: "var(--cm-color-keyword)" },
    // TODO: normal operators
    { tag: tags.definitionOperator, color: "var(--cm-color-keyword)" },
    { tag: tags.logicOperator, color: "var(--cm-color-keyword)" },
    { tag: tags.controlOperator, color: "var(--cm-color-keyword)" },
    { tag: tags.bracket, color: "var(--cm-color-bracket)" },
    // TODO: tags.self, tags.null
]

export const pluto_syntax_colors_julia = HighlightStyle.define(common_style_tags, {
    all: { color: `var(--cm-color-editor-text)` },
    scope: julia().language,
})

export const pluto_syntax_colors_javascript = HighlightStyle.define(common_style_tags, {
    all: { color: `var(--cm-color-editor-text)`, filter: `contrast(0.5)` },
    scope: javascriptLanguage,
})

export const pluto_syntax_colors_python = HighlightStyle.define(common_style_tags, {
    all: { color: `var(--cm-color-editor-text)`, filter: `contrast(0.5)` },
    scope: pythonLanguage,
})

export const pluto_syntax_color_any = HighlightStyle.define(common_style_tags, {
    all: { color: `var(--cm-color-editor-text)` },
})

export const pluto_syntax_colors_css = HighlightStyle.define(
    [
        { tag: tags.comment, color: "var(--cm-color-comment)", fontStyle: "italic" },
        { tag: tags.variableName, color: "var(--cm-color-css-accent)", fontWeight: 700 },
        { tag: tags.propertyName, color: "var(--cm-color-css-accent)", fontWeight: 700 },
        { tag: tags.tagName, color: "var(--cm-color-css)", fontWeight: 700 },
        //{ tag: tags.className,          color: "var(--cm-css-why-doesnt-codemirror-highlight-all-the-text-aaa)" },
        //{ tag: tags.constant(tags.className), color: "var(--cm-css-why-doesnt-codemirror-highlight-all-the-text-aaa)" },
        { tag: tags.definitionOperator, color: "var(--cm-color-css)" },
        { tag: tags.keyword, color: "var(--cm-color-css)" },
        { tag: tags.modifier, color: "var(--cm-color-css-accent)" },
        { tag: tags.literal, color: "var(--cm-color-css)" },
        // { tag: tags.unit,              color: "var(--cm-color-css-accent)" },
        { tag: tags.punctuation, opacity: 0.5 },
    ],
    {
        scope: cssLanguage,
        all: { color: "var(--cm-color-css)" },
    }
)

export const pluto_syntax_colors_html = HighlightStyle.define(
    [
        { tag: tags.comment, color: "var(--cm-color-comment)", fontStyle: "italic" },
        { tag: tags.content, color: "var(--cm-color-html)", fontWeight: 400 },
        { tag: tags.tagName, color: "var(--cm-color-html-accent)", fontWeight: 600 },
        { tag: tags.documentMeta, color: "var(--cm-color-html-accent)" },
        { tag: tags.attributeName, color: "var(--cm-color-html-accent)", fontWeight: 600 },
        { tag: tags.attributeValue, color: "var(--cm-color-html-accent)" },
        { tag: tags.angleBracket, color: "var(--cm-color-html-accent)", fontWeight: 600, opacity: 0.7 },
    ],
    {
        all: { color: "var(--cm-color-html)" },
        scope: htmlLanguage,
    }
)

// https://github.com/lezer-parser/markdown/blob/d4de2b03180ced4610bad9cef0ad3a805c43b63a/src/markdown.ts#L1890
export const pluto_syntax_colors_markdown = HighlightStyle.define(
    [
        { tag: tags.comment, color: "var(--cm-color-comment)", fontStyle: "italic" },
        { tag: tags.content, color: "var(--cm-color-md)" },
        { tag: tags.heading, color: "var(--cm-color-md)", fontWeight: 700 },
        // TODO? tags.list
        { tag: tags.quote, color: "var(--cm-color-md)" },
        { tag: tags.emphasis, fontStyle: "italic" },
        { tag: tags.strong, fontWeight: "bolder" },
        { tag: tags.link, textDecoration: "underline" },
        { tag: tags.url, color: "var(--cm-color-md)", textDecoration: "none" },
        { tag: tags.monospace, color: "var(--cm-color-md-accent)" },

        // Marks: `-` for lists, `#` for headers, etc.
        { tag: tags.processingInstruction, color: "var(--cm-color-md-accent) !important", opacity: "0.5" },
    ],
    {
        all: { color: "var(--cm-color-md)" },
        scope: markdownLanguage,
    }
)

const getValue6 = (/** @type {EditorView} */ cm) => cm.state.doc.toString()
const setValue6 = (/** @type {EditorView} */ cm, value) =>
    cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: value },
    })
const replaceRange6 = (/** @type {EditorView} */ cm, text, from, to) =>
    cm.dispatch({
        changes: { from, to, insert: text },
    })

// Compartments: https://codemirror.net/6/examples/config/
let useCompartment = (/** @type {import("../imports/Preact.js").Ref<EditorView?>} */ codemirror_ref, value) => {
    const compartment = useRef(new Compartment())
    const initial_value = useRef(compartment.current.of(value))

    useLayoutEffect(() => {
        codemirror_ref.current?.dispatch?.({
            effects: compartment.current.reconfigure(value),
        })
    }, [value])

    return initial_value.current
}

export const LastRemoteCodeSetTimeFacet = Facet.define({
    combine: (values) => values[0],
    compare: _.isEqual,
})

let line_and_ch_to_cm6_position = (/** @type {import("../imports/CodemirrorPlutoSetup.js").Text} */ doc, { line, ch }) => {
    let line_object = doc.line(_.clamp(line + 1, 1, doc.lines))
    let ch_clamped = _.clamp(ch, 0, line_object.length)
    return line_object.from + ch_clamped
}

/**
 * @param {{
 *  local_code: string,
 *  remote_code: string,
 *  scroll_into_view_after_creation: boolean,
 *  nbpkg: import("./Editor.js").NotebookPkgData?,
 *  global_definition_locations: { [variable_name: string]: string },
 *  [key: string]: any,
 * }} props
 */
export const CellInput = ({
    local_code,
    remote_code,
    disable_input,
    focus_after_creation,
    cm_forced_focus,
    set_cm_forced_focus,
    show_input,
    skip_static_fake = false,
    on_submit,
    on_delete,
    on_add_after,
    on_change,
    on_update_doc_query,
    on_focus_neighbor,
    on_line_heights,
    nbpkg,
    cell_id,
    notebook_id,
    any_logs,
    show_logs,
    set_show_logs,
    set_cell_disabled,
    cm_highlighted_line,
    cm_highlighted_range,
    metadata,
    global_definition_locations,
    cm_diagnostics,
}) => {
    let pluto_actions = useContext(PlutoActionsContext)
    const { disabled: running_disabled, skip_as_script } = metadata
    let [error, set_error] = useState(null)
    if (error) {
        const to_throw = error
        set_error(null)
        throw to_throw
    }

    const notebook_id_ref = useRef(notebook_id)
    notebook_id_ref.current = notebook_id

    const newcm_ref = useRef(/** @type {EditorView?} */ (null))
    const dom_node_ref = useRef(/** @type {HTMLElement?} */ (null))
    const remote_code_ref = useRef(/** @type {string?} */ (null))

    let nbpkg_compartment = useCompartment(newcm_ref, NotebookpackagesFacet.of(nbpkg))
    let global_definitions_compartment = useCompartment(newcm_ref, GlobalDefinitionsFacet.of(global_definition_locations))
    let highlighted_line_compartment = useCompartment(newcm_ref, HighlightLineFacet.of(cm_highlighted_line))
    let highlighted_range_compartment = useCompartment(newcm_ref, HighlightRangeFacet.of(cm_highlighted_range))
    let editable_compartment = useCompartment(newcm_ref, EditorState.readOnly.of(disable_input))
    let last_remote_code_set_time_compartment = useCompartment(
        newcm_ref,
        useMemo(() => LastRemoteCodeSetTimeFacet.of(Date.now()), [remote_code])
    )

    let on_change_compartment = useCompartment(
        newcm_ref,
        // Functions are hard to compare, so I useMemo manually
        useMemo(() => {
            return EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    on_change(update.state.doc.toString())
                }
            })
        }, [on_change])
    )

    const [show_static_fake_state, set_show_static_fake] = useState(!skip_static_fake)

    const show_static_fake_excuses_ref = useRef(false)
    show_static_fake_excuses_ref.current ||= navigator.userAgent.includes("Firefox") || focus_after_creation || cm_forced_focus != null || skip_static_fake

    const show_static_fake = show_static_fake_excuses_ref.current ? false : show_static_fake_state

    useLayoutEffect(() => {
        if (!show_static_fake) return
        let node = dom_node_ref.current
        if (node == null) return
        let observer

        const show = () => {
            set_show_static_fake(false)
            observer.disconnect()
            window.removeEventListener("beforeprint", show)
        }

        observer = new IntersectionObserver((e) => {
            if (e.some((e) => e.isIntersecting)) {
                show()
            }
        })

        observer.observe(node)
        window.addEventListener("beforeprint", show)
        return () => {
            observer.disconnect()
            window.removeEventListener("beforeprint", show)
        }
    }, [])

    useLayoutEffect(() => {
        if (show_static_fake) return
        if (dom_node_ref.current == null) return

        const keyMapSubmit = (/** @type {EditorView} */ cm) => {
            autocomplete.closeCompletion(cm)
            on_submit()
            return true
        }
        let run = async (fn) => await fn()
        const keyMapRun = (/** @type {EditorView} */ cm) => {
            autocomplete.closeCompletion(cm)
            run(async () => {
                // we await to prevent an out-of-sync issue
                await on_add_after()

                const new_value = cm.state.doc.toString()
                if (new_value !== remote_code_ref.current) {
                    on_submit()
                }
            })
            return true
        }

        let accept_autocomplete_command = autocomplete.completionKeymap.find((keybinding) => keybinding.key === "Enter")
        let keyMapTab = (/** @type {EditorView} */ cm) => {
            // I think this only gets called when we are not in an autocomplete situation, otherwise `tab_completion_command` is called. I think it only happens when you have a selection.

            if (cm.state.readOnly) {
                return false
            }
            // This will return true if the autocomplete select popup is open
            if (accept_autocomplete_command?.run?.(cm)) {
                return true
            }

            const anySelect = cm.state.selection.ranges.some((r) => !r.empty)
            if (anySelect) {
                return indentMore(cm)
            } else {
                cm.dispatch(
                    cm.state.changeByRange((selection) => ({
                        range: EditorSelection.cursor(selection.from + 1),
                        changes: { from: selection.from, to: selection.to, insert: "\t" },
                    }))
                )
                return true
            }
        }
        const keyMapMD = () => {
            const cm = /** @type{EditorView} */ (newcm_ref.current)
            const value = getValue6(cm)
            const trimmed = value.trim()
            const offset = value.length - value.trimStart().length
            if (trimmed.startsWith('md"') && trimmed.endsWith('"')) {
                // Markdown cell, change to code
                let start, end
                if (trimmed.startsWith('md"""') && trimmed.endsWith('"""')) {
                    // Block markdown
                    start = 5
                    end = trimmed.length - 3
                } else {
                    // Inline markdown
                    start = 3
                    end = trimmed.length - 1
                }
                if (start >= end || trimmed.substring(start, end).trim() == "") {
                    // Corner case: block is empty after removing markdown
                    setValue6(cm, "")
                } else {
                    while (/\s/.test(trimmed[start])) {
                        ++start
                    }
                    while (/\s/.test(trimmed[end - 1])) {
                        --end
                    }

                    // Keep the selection from [start, end) while maintaining cursor position
                    replaceRange6(cm, "", end + offset, cm.state.doc.length)
                    // cm.replaceRange("", cm.posFromIndex(end + offset), { line: cm.lineCount() })
                    replaceRange6(cm, "", 0, start + offset)
                    // cm.replaceRange("", { line: 0, ch: 0 }, cm.posFromIndex(start + offset))
                }
            } else {
                // Replacing ranges will maintain both the focus, the selections and the cursor
                let prefix = `md"""\n`
                let suffix = `\n"""`
                // TODO Multicursor?
                let selection = cm.state.selection.main
                cm.dispatch({
                    changes: [
                        { from: 0, to: 0, insert: prefix },
                        {
                            from: cm.state.doc.length,
                            to: cm.state.doc.length,
                            insert: suffix,
                        },
                    ],
                    selection:
                        selection.from === 0
                            ? {
                                  anchor: selection.from + prefix.length,
                                  head: selection.to + prefix.length,
                              }
                            : undefined,
                })
            }

            return true
        }
        const keyMapDelete = (/** @type {EditorView} */ cm) => {
            if (cm.state.facet(EditorState.readOnly)) {
                return false
            }
            if (cm.state.doc.length === 0) {
                on_focus_neighbor(cell_id, +1)
                on_delete()
                return true
            }
            return false
        }

        const keyMapBackspace = (/** @type {EditorView} */ cm) => {
            if (cm.state.facet(EditorState.readOnly)) {
                return false
            }

            // Previously this was a very elaborate timed implementation......
            // But I found out that keyboard events have a `.repeated` property which is perfect for what we want...
            // So now this is just the cell deleting logic (and the repeated stuff is in a separate plugin)
            if (cm.state.doc.length === 0) {
                // `Infinity, Infinity` means: last line, last character
                on_focus_neighbor(cell_id, -1, Infinity, Infinity)
                on_delete()
                return true
            }
            return false
        }

        const keyMapMoveLine = (/** @type {EditorView} */ cm, direction) => {
            if (cm.state.facet(EditorState.readOnly)) {
                return false
            }

            const selection = cm.state.selection.main
            const all_is_selected = selection.anchor === 0 && selection.head === cm.state.doc.length

            if (all_is_selected || cm.state.doc.lines === 1) {
                pluto_actions.move_remote_cells([cell_id], pluto_actions.get_notebook().cell_order.indexOf(cell_id) + (direction === -1 ? -1 : 2))

                // workaround for https://github.com/preactjs/preact/issues/4235
                // but the scrollIntoView behaviour is nice, also when the preact issue is fixed.
                requestIdleCallback(() => {
                    cm.dispatch({
                        // TODO: remove me after fix
                        selection: {
                            anchor: 0,
                            head: cm.state.doc.length,
                        },

                        // TODO: keep me after fix
                        scrollIntoView: true,
                    })
                    // TODO: remove me after fix
                    cm.focus()
                })
                return true
            } else {
                return direction === 1 ? moveLineDown(cm) : moveLineUp(cm)
            }
        }
        const keyMapFold = (/** @type {EditorView} */ cm, new_value) => {
            set_cm_forced_focus(true)
            pluto_actions.fold_remote_cells([cell_id], new_value)
            return true
        }

        const plutoKeyMaps = [
            { key: "Shift-Enter", run: keyMapSubmit },
            { key: "Ctrl-Enter", mac: "Cmd-Enter", run: keyMapRun },
            { key: "Ctrl-Enter", run: keyMapRun },
            { key: "Tab", run: keyMapTab, shift: indentLess },
            { key: "Ctrl-m", mac: "Cmd-m", run: keyMapMD },
            { key: "Ctrl-m", run: keyMapMD },
            // Codemirror6 doesn't like capslock
            { key: "Ctrl-M", run: keyMapMD },
            // TODO Move Delete and backspace to cell movement plugin
            { key: "Delete", run: keyMapDelete },
            { key: "Ctrl-Delete", run: keyMapDelete },
            { key: "Backspace", run: keyMapBackspace },
            { key: "Ctrl-Backspace", run: keyMapBackspace },
            { key: "Alt-ArrowUp", run: (x) => keyMapMoveLine(x, -1) },
            { key: "Alt-ArrowDown", run: (x) => keyMapMoveLine(x, 1) },
            { key: "Ctrl-Shift-[", mac: "Cmd-Alt-[", run: (x) => keyMapFold(x, true) },
            { key: "Ctrl-Shift-]", mac: "Cmd-Alt-]", run: (x) => keyMapFold(x, false) },
            mod_d_command,
        ]

        let DOCS_UPDATER_VERBOSE = false
        const docs_updater = EditorView.updateListener.of((update) => {
            if (!update.view.hasFocus) {
                return
            }

            if (update.docChanged || update.selectionSet) {
                let state = update.state
                DOCS_UPDATER_VERBOSE && console.groupCollapsed("Live docs updater from docChange or selectionSet")
                try {
                    let result = get_selected_doc_from_state(state, DOCS_UPDATER_VERBOSE)
                    if (result != null) {
                        on_update_doc_query(result)
                    }
                } finally {
                    DOCS_UPDATER_VERBOSE && console.groupEnd()
                }
            }
        })

        const unsubmitted_globals_updater = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                const before = [...update.startState.field(ScopeStateField).definitions.keys()]
                const after = [...update.state.field(ScopeStateField).definitions.keys()]

                if (!_.isEqual(before, after)) {
                    pluto_actions.set_unsubmitted_global_definitions(cell_id, after)
                }
            }
        })

        const usesDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        const newcm = (newcm_ref.current = new EditorView({
            state: EditorState.create({
                doc: local_code,
                extensions: [
                    EditorView.theme({}, { dark: usesDarkTheme }),
                    // Compartments coming from react state/props
                    nbpkg_compartment,
                    highlighted_line_compartment,
                    highlighted_range_compartment,
                    global_definitions_compartment,
                    editable_compartment,
                    last_remote_code_set_time_compartment,
                    highlightLinePlugin(),
                    highlightRangePlugin(),

                    // This is waaaay in front of the keys it is supposed to override,
                    // Which is necessary because it needs to run before *any* keymap,
                    // as the first keymap will activate the keymap extension which will attach the
                    // keymap handlers at that point, which is likely before this extension.
                    // TODO Use https://codemirror.net/6/docs/ref/#state.Prec when added to pluto-codemirror-setup
                    prevent_holding_a_key_from_doing_things_across_cells,

                    pkgBubblePlugin({ pluto_actions, notebook_id_ref }),
                    ScopeStateField,
                    syntaxHighlighting(pluto_syntax_colors_julia),
                    syntaxHighlighting(pluto_syntax_colors_html),
                    syntaxHighlighting(pluto_syntax_colors_markdown),
                    syntaxHighlighting(pluto_syntax_colors_javascript),
                    syntaxHighlighting(pluto_syntax_colors_python),
                    syntaxHighlighting(pluto_syntax_colors_css),
                    lineNumbers(),
                    highlightSpecialChars(),
                    history(),
                    drawSelection(),
                    EditorState.allowMultipleSelections.of(true),
                    // Multiple cursors with `alt` instead of the default `ctrl` (which we use for go to definition)
                    EditorView.clickAddsSelectionRange.of((event) => event.altKey && !event.shiftKey),
                    indentOnInput(),
                    // Experimental: Also add closing brackets for tripple string
                    // TODO also add closing string when typing a string macro
                    EditorState.languageData.of((state, pos, side) => {
                        return [{ closeBrackets: { brackets: ["(", "[", "{"] } }]
                    }),
                    closeBrackets(),
                    rectangularSelection({
                        eventFilter: (e) => e.altKey && e.shiftKey && e.button == 0,
                    }),
                    highlightSelectionMatches({ minSelectionLength: 2, wholeWords: true }),
                    bracketMatching(),
                    docs_updater,
                    unsubmitted_globals_updater,
                    tab_help_plugin,
                    // Remove selection on blur
                    EditorView.domEventHandlers({
                        blur: (event, view) => {
                            // it turns out that this condition is true *exactly* if and only if the blur event was triggered by blurring the window
                            let caused_by_window_blur = document.activeElement === view.contentDOM

                            if (!caused_by_window_blur) {
                                // then it's caused by focusing something other than this cell in the editor.
                                // in this case, we want to collapse the selection into a single point, for aesthetic reasons.
                                setTimeout(() => {
                                    view.dispatch({
                                        selection: {
                                            anchor: view.state.selection.main.head,
                                        },
                                        scrollIntoView: false,
                                    })
                                    // and blur the DOM again (because the previous transaction might have re-focused it)
                                    view.contentDOM.blur()
                                }, 0)

                                set_cm_forced_focus(null)
                            }
                        },
                    }),
                    pluto_paste_plugin({
                        pluto_actions,
                        cell_id,
                    }),
                    // Update live docs when in a cell that starts with `?`
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged) return
                        if (update.state.doc.length > 0 && update.state.sliceDoc(0, 1) === "?") {
                            open_bottom_right_panel("docs")
                        }
                    }),
                    EditorState.tabSize.of(4),
                    indentUnit.of("\t"),
                    ...(ENABLE_CM_MIXED_PARSER
                        ? [
                              julia_mixed(),
                              markdown({
                                  defaultCodeLanguage: julia_mixed(),
                              }),
                              htmlLang(), //Provides tag closing!,
                              javascript(),
                              python(),
                              sqlLang,
                          ]
                        : [
                              //
                              julia(),
                          ]),
                    go_to_definition_plugin,
                    AiSuggestionPlugin(),
                    pluto_autocomplete({
                        request_autocomplete: async ({ query, query_full }) => {
                            let response = await timeout_promise(
                                pluto_actions.send("complete", { query, query_full }, { notebook_id: notebook_id_ref.current }),
                                5000
                            ).catch(console.warn)
                            if (!response) return null

                            let { message } = response

                            return {
                                start: utf8index_to_ut16index(query_full ?? query, message.start),
                                stop: utf8index_to_ut16index(query_full ?? query, message.stop),
                                results: message.results,
                                too_long: message.too_long,
                            }
                        },
                        request_packages: () => pluto_actions.send("all_registered_package_names").then(({ message }) => message.results),
                        request_special_symbols: () => pluto_actions.send("complete_symbols").then(({ message }) => message),
                        on_update_doc_query,
                        request_unsubmitted_global_definitions: () => pluto_actions.get_unsubmitted_global_definitions(),
                        cell_id,
                    }),

                    // I put plutoKeyMaps separately because I want make sure we have
                    // higher priority 😈
                    keymap.of(plutoKeyMaps),
                    keymap.of(commentKeymap),
                    // Before default keymaps (because we override some of them)
                    // but after the autocomplete plugin, because we don't want to move cell when scrolling through autocomplete
                    cell_movement_plugin({
                        focus_on_neighbor: ({ cell_delta, line, character }) => on_focus_neighbor(cell_id, cell_delta, line, character),
                    }),
                    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
                    placeholder(t("t_cell_input_placeholder")),

                    EditorView.contentAttributes.of({ spellcheck: String(ENABLE_CM_SPELLCHECK) }),

                    EditorView.lineWrapping,
                    awesome_line_wrapping,

                    // Reset diagnostics on change
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged) return
                        update.view.dispatch(setDiagnostics(update.state, []))
                    }),

                    on_change_compartment,

                    // This is my weird-ass extension that checks the AST and shows you where
                    // there're missing nodes.. I'm not sure if it's a good idea to have it
                    // show_missing_syntax_plugin(),

                    // Enable this plugin if you want to see the lezer tree,
                    // and possible lezer errors and maybe more debug info in the console:
                    // debug_syntax_plugin,
                    // Handle errors hopefully?
                    EditorView.exceptionSink.of((exception) => {
                        set_error(exception)
                        console.error("EditorView exception!", exception)
                        // alert(
                        //     `We ran into an issue! We have lost your cursor 😞😓😿\n If this appears again, please press F12, then click the "Console" tab,  eport an issue at https://github.com/JuliaPluto/Pluto.jl/issues`
                        // )
                    }),
                ],
            }),
            parent: dom_node_ref.current,
        }))

        // For use from useDropHandler
        // @ts-ignore
        newcm.dom.CodeMirror = {
            getValue: () => getValue6(newcm),
            setValue: (x) => setValue6(newcm, x),
        }

        if (focus_after_creation) {
            setTimeout(() => {
                let view = newcm_ref.current
                if (view == null) return
                view.dom.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                })
                view.dispatch({
                    selection: {
                        anchor: view.state.doc.length,
                        head: view.state.doc.length,
                    },
                    effects: [LastFocusWasForcedEffect.of(true)],
                })
                view.focus()
            })
        }

        // @ts-ignore
        const lines_wrapper_dom_node = dom_node_ref.current.querySelector("div.cm-content")
        if (lines_wrapper_dom_node) {
            const lines_wrapper_resize_observer = new ResizeObserver(() => {
                const line_nodes = lines_wrapper_dom_node.children
                const tops = _.map(line_nodes, (c) => /** @type{HTMLElement} */ (c).offsetTop)
                const diffs = tops.slice(1).map((y, i) => y - tops[i])
                const heights = [...diffs, 15]
                on_line_heights(heights)
            })

            lines_wrapper_resize_observer.observe(lines_wrapper_dom_node)
            return () => {
                lines_wrapper_resize_observer.unobserve(lines_wrapper_dom_node)
            }
        }
    }, [show_static_fake])

    useEffect(() => {
        if (newcm_ref.current == null) return
        const cm = newcm_ref.current
        const diagnostics = cm_diagnostics

        cm.dispatch(setDiagnostics(cm.state, diagnostics))
    }, [cm_diagnostics])

    // Effect to apply "remote_code" to the cell when it changes...
    // ideally this won't be necessary as we'll have actual multiplayer,
    // or something to tell the user that the cell is out of sync.
    useEffect(() => {
        if (newcm_ref.current == null) return // Not sure when and why this gave an error, but now it doesn't

        const current_value = getValue6(newcm_ref.current) ?? ""
        if (remote_code_ref.current == null && remote_code === "" && current_value !== "") {
            // this cell is being initialized with empty code, but it already has local code set.
            // this happens when pasting or dropping cells
            return
        }
        remote_code_ref.current = remote_code
        if (current_value !== remote_code) {
            setValue6(newcm_ref.current, remote_code)
        }
    }, [remote_code])

    useEffect(() => {
        const cm = newcm_ref.current
        if (cm == null) return
        if (cm_forced_focus == null) {
            cm.dispatch({
                selection: {
                    anchor: cm.state.selection.main.head,
                    head: cm.state.selection.main.head,
                },
            })
        } else if (cm_forced_focus === true) {
        } else {
            let new_selection = {
                anchor: line_and_ch_to_cm6_position(cm.state.doc, cm_forced_focus[0]),
                head: line_and_ch_to_cm6_position(cm.state.doc, cm_forced_focus[1]),
            }

            if (cm_forced_focus[2]?.definition_of) {
                let scopestate = cm.state.field(ScopeStateField)
                let definition = scopestate?.definitions.get(cm_forced_focus[2]?.definition_of)
                if (definition) {
                    new_selection = {
                        anchor: definition.from,
                        head: definition.to,
                    }
                }
            }

            let dom = /** @type {HTMLElement} */ (cm.dom)
            dom.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                // UNCOMMENT THIS AND SEE, this feels amazing but I feel like people will not like it
                // block: "center",
            })

            cm.focus()
            cm.dispatch({
                scrollIntoView: true,
                selection: new_selection,
                effects: [
                    EditorView.scrollIntoView(EditorSelection.range(new_selection.anchor, new_selection.head), {
                        yMargin: 80,
                    }),
                    LastFocusWasForcedEffect.of(true),
                ],
            })
        }
    }, [cm_forced_focus])

    return html`
        <pluto-input ref=${dom_node_ref} class="CodeMirror" translate=${false}>
            ${show_static_fake ? (show_input ? html`<${StaticCodeMirrorFaker} value=${remote_code} />` : null) : null}
            <${InputContextMenu}
                on_delete=${on_delete}
                cell_id=${cell_id}
                run_cell=${on_submit}
                skip_as_script=${skip_as_script}
                running_disabled=${running_disabled}
                any_logs=${any_logs}
                show_logs=${show_logs}
                set_show_logs=${set_show_logs}
                set_cell_disabled=${set_cell_disabled}
                get_current_code=${() => {
                    let cm = newcm_ref.current
                    return cm == null ? "" : getValue6(cm)
                }}
            />
            ${PreviewHiddenCode}
        </pluto-input>
    `
}

const PreviewHiddenCode = html`<div class="preview_hidden_code_info">${t("t_reading_hidden_code")}</div>`

const InputContextMenu = ({
    on_delete,
    cell_id,
    run_cell,
    skip_as_script,
    running_disabled,
    any_logs,
    show_logs,
    set_show_logs,
    set_cell_disabled,
    get_current_code,
}) => {
    const timeout = useRef(null)
    let pluto_actions = useContext(PlutoActionsContext)
    const [open, setOpenState] = useState(false)
    const button_ref = useRef(/** @type {HTMLButtonElement?} */ (null))
    const list_ref = useRef(/** @type {HTMLButtonElement?} */ (null))

    const prevously_focused_element_ref = useRef(/** @type {Element?} */ (null))
    const setOpen = (val) => {
        if (val) {
            prevously_focused_element_ref.current = document.activeElement
        }
        setOpenState(val)
    }
    useLayoutEffect(() => {
        if (open) {
            list_ref.current?.querySelector("button")?.focus()
        } else {
            let e = prevously_focused_element_ref.current
            if (e instanceof HTMLElement) e.focus()
        }
    }, [open])

    const mouseenter = () => {
        if (timeout.current) clearTimeout(timeout.current)
    }
    const toggle_skip_as_script = async (e) => {
        const new_val = !skip_as_script
        e.preventDefault()
        // e.stopPropagation()
        await pluto_actions.update_notebook((notebook) => {
            notebook.cell_inputs[cell_id].metadata["skip_as_script"] = new_val
        })
    }
    const toggle_running_disabled = async (e) => {
        const new_val = !running_disabled
        await set_cell_disabled(new_val)
    }
    const toggle_logs = () => set_show_logs(!show_logs)

    const is_copy_output_supported = () => {
        let notebook = /** @type{import("./Editor.js").NotebookData?} */ (pluto_actions.get_notebook())
        let cell_result = notebook?.cell_results?.[cell_id]
        if (cell_result == null) return false

        return (
            (!cell_result.errored && cell_result.output.mime === "text/plain" && !!cell_result.output.body) ||
            (cell_result.errored && cell_result.output.mime === "application/vnd.pluto.stacktrace+object")
        )
    }

    const strip_ansi_codes = (s) => (typeof s === "string" ? s.replace(/\x1b\[[0-9;]*m/g, "") : s)

    const copy_output = () => {
        let notebook = /** @type{import("./Editor.js").NotebookData?} */ (pluto_actions.get_notebook())
        let cell_result = notebook?.cell_results?.[cell_id]
        if (cell_result == null) return

        let cell_output =
            cell_result.output.mime === "text/plain"
                ? cell_result.output.body
                : // @ts-ignore
                  cell_result.output.body.plain_error

        if (cell_output != null)
            navigator.clipboard.writeText(strip_ansi_codes(cell_output)).catch(() => {
                alert(`Error copying cell output`)
            })
    }

    const ask_ai = () => {
        open_pluto_popup({
            type: "info",
            big: true,
            css_class: "ai-context",
            should_focus: true,
            // source_element: button_ref.current,
            body: html`<${AIContext} cell_id=${cell_id} current_code=${get_current_code()} />`,
        })
    }

    useEventListener(
        window,
        "keydown",
        (/** @type {KeyboardEvent} */ e) => {
            if (e.key === "Escape") {
                setOpen(false)
            }
        },
        []
    )

    return html`
        <button
            onClick=${(e) => {
                setOpen(!open)
            }}
            class=${cl({
                input_context_menu: true,
                open,
            })}
            title="Actions"
            ref=${button_ref}
        >
            <span class="icon"></span>
        </button>
        <div
            class=${cl({
                input_context_menu: true,
                open,
            })}
            ref=${list_ref}
            onfocusout=${(e) => {
                const li_focused = list_ref.current?.matches(":focus-within") || list_ref.current?.contains(e.relatedTarget)

                if (
                    !li_focused ||
                    // or the focus is on the list itself
                    e.relatedTarget === list_ref.current
                )
                    setOpen(false)
            }}
        >
            ${open
                ? html`<ul onMouseenter=${mouseenter}>
                      <${InputContextMenuItem}
                          tag="delete"
                          contents=${t("t_delete_cell_action")}
                          title=${t("t_delete_cell_action")}
                          onClick=${on_delete}
                          setOpen=${setOpen}
                      />

                      <${InputContextMenuItem}
                          title=${running_disabled ? t("t_enable_and_run_cell") : t("t_disable_this_cell_and_all_cells_that_depend_on_it")}
                          tag=${running_disabled ? "enable_cell" : "disable_cell"}
                          contents=${running_disabled ? html`<b>${t("t_enable_cell_action")}</b>` : html`${t("t_disable_cell_action")}`}
                          onClick=${toggle_running_disabled}
                          setOpen=${setOpen}
                      />
                      ${any_logs
                          ? html`<${InputContextMenuItem}
                                title=${show_logs ? t("t_show_logs_action_description") : t("t_hide_logs_action_description")}
                                tag=${show_logs ? "hide_logs" : "show_logs"}
                                contents=${show_logs ? t("t_hide_logs_action") : t("t_show_logs_action")}
                                onClick=${toggle_logs}
                                setOpen=${setOpen}
                            />`
                          : null}
                      ${is_copy_output_supported()
                          ? html`<${InputContextMenuItem}
                                tag="copy_output"
                                contents=${t("t_copy_output_action")}
                                title=${t("t_copy_output_action_description")}
                                onClick=${copy_output}
                                setOpen=${setOpen}
                            />`
                          : null}

                      <${InputContextMenuItem}
                          title=${skip_as_script ? t("t_enable_in_file_action_description") : t("t_disable_in_file_action_description")}
                          tag=${skip_as_script ? "run_as_script" : "skip_as_script"}
                          contents=${skip_as_script ? html`<b>${t("t_enable_in_file_action")}</b>` : html`${t("t_disable_in_file_action")}`}
                          onClick=${toggle_skip_as_script}
                          setOpen=${setOpen}
                      />

                      ${pluto_actions.get_session_options?.()?.server?.enable_ai_editor_features !== false
                          ? html`<${InputContextMenuItem}
                                tag="ask_ai"
                                contents=${t("t_ask_ai_action")}
                                title=${t("t_ask_ai_action_description")}
                                onClick=${ask_ai}
                                setOpen=${setOpen}
                            />`
                          : null}
                  </ul>`
                : html``}
        </div>
    `
}

const InputContextMenuItem = ({ contents, title, onClick, setOpen, tag }) =>
    html`<li>
        <button
            tabindex="0"
            title=${title}
            onClick=${(e) => {
                setOpen(false)
                onClick(e)
            }}
            class=${tag}
        >
            <span class=${`${tag} ctx_icon`} />${contents}
        </button>
    </li>`

const StaticCodeMirrorFaker = ({ value }) => {
    const lines = value.split("\n").map((line, i) => {
        const start_tabs = get_start_tabs(line)

        const tabbed_line =
            start_tabs.length == 0
                ? line
                : html`<span class="awesome-wrapping-plugin-the-tabs"><span class="ͼo">${start_tabs}</span></span
                      >${line.substring(start_tabs.length)}`

        return html`<div class="awesome-wrapping-plugin-the-line cm-line" style="--indented: ${4 * start_tabs.length}ch;">
            ${line.length === 0 ? html`<br />` : tabbed_line}
        </div>`
    })

    return html`
        <div class="cm-editor ͼ1 ͼ2 ͼ4 ͼ4z cm-ssr-fake">
            <div tabindex="-1" class="cm-scroller">
                <div class="cm-gutters" aria-hidden="true">
                    <div class="cm-gutter cm-lineNumbers"></div>
                </div>
                <div
                    spellcheck="false"
                    autocorrect="off"
                    autocapitalize="off"
                    translate="no"
                    contenteditable="false"
                    style="tab-size: 4;"
                    class="cm-content cm-lineWrapping"
                    role="textbox"
                    aria-multiline="true"
                    aria-autocomplete="list"
                >
                    ${lines}
                </div>
            </div>
        </div>
    `
}
