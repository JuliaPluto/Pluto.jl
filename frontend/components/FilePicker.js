import { html, useState, useRef, useLayoutEffect } from "../imports/Preact.js"

import { utf8index_to_ut16index } from "../common/UnicodeTools.js"

import {
    EditorState,
    EditorSelection,
    EditorView,
    placeholder as Placeholder,
    keymap,
    history,
    autocomplete,
    drawSelection,
} from "../imports/CodemirrorPlutoSetup.js"
import { guess_notebook_location } from "../common/NotebookLocationFromURL.js"
import { tab_help_plugin } from "./CellInput/tab_help_plugin.js"
import _ from "../imports/lodash.js"

let { autocompletion, completionKeymap } = autocomplete

let start_autocomplete_command = completionKeymap.find((keybinding) => keybinding.key === "Ctrl-Space")
let accept_autocomplete_command = completionKeymap.find((keybinding) => keybinding.key === "Enter")
let close_autocomplete_command = completionKeymap.find((keybinding) => keybinding.key === "Escape")

const assert_not_null = (x) => {
    if (x == null) {
        throw new Error("Unexpected null value")
    } else {
        return x
    }
}

export const set_cm_value = (/** @type{EditorView} */ cm, /** @type {string} */ value, scroll = true) => {
    cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: value },
        selection: EditorSelection.cursor(value.length),
        // a long path like /Users/fons/Documents/article-test-1/asdfasdfasdfsadf.jl does not fit in the little box, so we scroll it to the left so that you can see the filename easily.
        scrollIntoView: scroll,
    })
}

/**
 * @param {{
 *  value: String,
 *  suggest_new_file?: {base: String},
 *  button_label: String,
 *  placeholder: String,
 *  on_submit: (new_path: String) => Promise<void>,
 *  client: import("../common/PlutoConnection.js").PlutoConnection,
 *  clear_on_blur: Boolean,
 * }} props
 */
export const FilePicker = ({ value, suggest_new_file, button_label, placeholder, on_submit, client, clear_on_blur }) => {
    const [current_value, set_current_value] = useState(value)

    const [url_value, set_url_value] = useState("")
    const forced_value = useRef("")
    /** @type {import("../imports/Preact.js").Ref<HTMLElement>} */
    const base = useRef(/** @type {any} */ (null))
    const cm = useRef(/** @type {EditorView?} */ (null))

    const is_button_disabled = current_value.length === 0 || current_value === forced_value.current
    const suggest_button = current_value !== forced_value.current && current_value.endsWith(".jl")

    const suggest_not_tmp = () => {
        const current_cm = cm.current
        if (current_cm == null) return
        if (suggest_new_file != null && current_cm.state.doc.length === 0) {
            // current_cm.focus()
            set_cm_value(current_cm, suggest_new_file.base, false)
            request_path_completions()
        }
        window.dispatchEvent(new CustomEvent("collapse_cell_selection", {}))
    }

    let run = async (fn) => await fn()

    const onSubmit = () => {
        const current_cm = cm.current
        if (current_cm == null) return
        run(async () => {
            try {
                await on_submit(current_cm.state.doc.toString())
                current_cm.dom.blur()
            } catch (error) {
                set_cm_value(current_cm, forced_value.current, true)
                current_cm.dom.blur()
            }
        })
        return true
    }

    const onBlur = (e) => {
        const still_in_focus = base.current?.matches(":focus-within") || base.current?.contains(e.relatedTarget)
        if (still_in_focus) return
        const current_cm = cm.current
        if (current_cm == null) return
        if (clear_on_blur)
            requestAnimationFrame(() => {
                if (!current_cm.hasFocus) {
                    set_cm_value(current_cm, forced_value.current, true)
                }
            })
    }

    const request_path_completions = () => {
        const current_cm = cm.current
        if (current_cm == null) return
        let selection = current_cm.state.selection.main
        if (selection.from !== selection.to) return
        if (current_cm.state.doc.length !== selection.to) return
        return assert_not_null(start_autocomplete_command).run(current_cm)
    }

    useLayoutEffect(() => {
        const usesDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        const keyMapSubmit = () => {
            onSubmit()
            return true
        }
        cm.current = new EditorView({
            state: EditorState.create({
                doc: "",
                extensions: [
                    drawSelection(),
                    EditorView.domEventHandlers({
                        focus: (event, cm) => {
                            setTimeout(() => {
                                if (suggest_new_file) {
                                    suggest_not_tmp()
                                } else {
                                    request_path_completions()
                                }
                            }, 0)
                            return true
                        },
                    }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            set_current_value(update.state.doc.toString())
                        }
                    }),
                    EditorView.theme(
                        {
                            "&": {
                                fontSize: "inherit",
                            },
                            ".cm-scroller": {
                                fontFamily: "inherit",
                                overflowY: "hidden",
                                overflowX: "auto",
                            },
                        },
                        { dark: usesDarkTheme }
                    ),
                    // EditorView.updateListener.of(onCM6Update),
                    history(),
                    autocompletion({
                        activateOnTyping: true,
                        override: [
                            pathhints({
                                suggest_new_file: suggest_new_file,
                                client: client,
                            }),
                        ],
                        defaultKeymap: false, // We add these manually later, so we can override them if necessary
                        maxRenderedOptions: 512, // fons's magic number
                        optionClass: (c) => c.type ?? "",
                    }),
                    // When a completion is picked, immediately start autocompleting again
                    EditorView.updateListener.of((update) => {
                        update.transactions.forEach((transaction) => {
                            const completion = transaction.annotation(autocomplete.pickedCompletion)
                            if (completion != null) {
                                update.view.dispatch({
                                    effects: EditorView.scrollIntoView(update.state.doc.length),
                                    selection: EditorSelection.cursor(update.state.doc.length),
                                })

                                request_path_completions()
                            }
                        })
                    }),
                    keymap.of([
                        {
                            key: "Enter",
                            run: (cm) => {
                                // If there is autocomplete open, accept that. It will return `true`
                                return assert_not_null(accept_autocomplete_command).run(cm)
                            },
                        },
                        {
                            key: "Enter",
                            run: keyMapSubmit,
                        },
                        {
                            key: "Ctrl-Enter",
                            mac: "Cmd-Enter",
                            run: keyMapSubmit,
                        },
                        {
                            key: "Ctrl-Shift-Enter",
                            mac: "Cmd-Shift-Enter",
                            run: keyMapSubmit,
                        },
                        {
                            key: "Tab",
                            run: (cm) => {
                                // If there is autocomplete open, accept that
                                if (assert_not_null(accept_autocomplete_command).run(cm)) {
                                    // and request the next ones
                                    request_path_completions()
                                    return true
                                }
                                // Else, activate it (possibly)
                                return request_path_completions()
                            },
                        },
                    ]),
                    keymap.of(completionKeymap),

                    Placeholder(placeholder),
                    tab_help_plugin,
                ],
            }),
        })
        const current_cm = cm.current

        base.current.insertBefore(current_cm.dom, base.current.firstElementChild)
        // window.addEventListener("resize", () => {
        //     if (!cm.current.hasFocus()) {
        //         deselect(cm.current)
        //     }
        // })
    }, [])

    useLayoutEffect(() => {
        if (forced_value.current != value) {
            if (cm.current == null) return
            set_cm_value(cm.current, value, true)
            forced_value.current = value
        }
    })

    return html`
        <pluto-filepicker class=${suggest_button ? "suggest_button" : ""} ref=${base} onfocusout=${onBlur}>
            <button onClick=${onSubmit} disabled=${is_button_disabled}>${button_label}</button>
        </pluto-filepicker>
    `
}

const dirname = (/** @type {string} */ str) => {
    // using regex /\/|\\/
    const idx = [...str.matchAll(/[\/\\]/g)].map((r) => r.index)
    return idx.length > 0 ? str.slice(0, idx[idx.length - 1] + 1) : str
}

const basename = (/** @type {string} */ str) => (str.split("/").pop() ?? "").split("\\").pop() ?? ""

/**
 * @param {{
 *  client: import("../common/PlutoConnection.js").PlutoConnection,
 *  suggest_new_file?: {base: String},
 * }} props
 *
 * @returns {autocomplete.CompletionSource}
 */
const pathhints =
    ({ client, suggest_new_file }) =>
    (ctx) => {
        const query_full = /** @type {String} */ (ctx.state.sliceDoc(0, ctx.pos))
        const query = dirname(query_full)

        return client
            .send("completepath", {
                query,
            })
            .then((update) => {
                const queryFileName = basename(query_full)

                const results = update.message.results
                const from = utf8index_to_ut16index(query, update.message.start)

                // if the typed text matches one of the paths exactly, stop autocomplete immediately.
                if (results.includes(queryFileName)) {
                    return null
                }

                let styledResults = results.map((r) => {
                    let dir = r.endsWith("/") || r.endsWith("\\")
                    return {
                        label: r,
                        type: dir ? "dir" : "file",
                        boost: dir ? 40 : 0,
                    }
                })

                if (suggest_new_file != null) {
                    for (let initLength = 3; initLength >= 0; initLength--) {
                        const init = ".jl".substring(0, initLength)
                        if (queryFileName.endsWith(init)) {
                            let suggestedFileName = queryFileName + ".jl".substring(initLength)

                            if (suggestedFileName == ".jl") {
                                suggestedFileName = "notebook.jl"
                            }

                            if (initLength == 3) {
                                return null
                            }
                            if (!results.includes(suggestedFileName)) {
                                styledResults.push({
                                    label: suggestedFileName + " (new)",
                                    apply: suggestedFileName,
                                    type: "file new",
                                    boost: 20,
                                })
                            }
                            break
                        }
                    }
                }

                const startpos = ctx.pos
                const validFor = (/** @type {string} */ text, from, to) => {
                    return (
                        to >= startpos &&
                        /[\p{L}\p{Nl}\p{Sc}\d_!-\.]*$/u.test(text) &&
                        // if the typed text matches one of the paths exactly, stop autocomplete immediately.
                        !results.includes(basename(text))
                    )
                }

                return {
                    options: styledResults,
                    from: from,
                    to: ctx.state.doc.length,
                    validFor: suggest_new_file ? undefined : validFor,
                }
            })
    }
