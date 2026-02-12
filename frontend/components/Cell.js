import _ from "../imports/lodash.js"
import { html, useState, useEffect, useMemo, useRef, useContext, useLayoutEffect, useErrorBoundary, useCallback } from "../imports/Preact.js"

import { CellOutput } from "./CellOutput.js"
import { CellInput } from "./CellInput.js"
import { Logs } from "./Logs.js"
import { RunArea, useDebouncedTruth } from "./RunArea.js"
import { cl } from "../common/ClassTable.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { open_pluto_popup } from "../common/open_pluto_popup.js"
import { SafePreviewOutput } from "./SafePreviewUI.js"
import { useEventListener } from "../common/useEventListener.js"
import { t, th } from "../common/lang.js"

const useCellApi = (node_ref, published_object_keys, pluto_actions) => {
    const [cell_api_ready, set_cell_api_ready] = useState(false)
    const published_object_keys_ref = useRef(published_object_keys)
    published_object_keys_ref.current = published_object_keys

    useLayoutEffect(() => {
        Object.assign(node_ref.current, {
            getPublishedObject: (id) => {
                if (!published_object_keys_ref.current.includes(id)) throw `getPublishedObject: ${id} not found`
                return pluto_actions.get_published_object(id)
            },
            _internal_pluto_actions: pluto_actions,
        })

        set_cell_api_ready(true)
    })

    return cell_api_ready
}

/**
 * @param {String} a_cell_id
 * @param {import("./Editor.js").NotebookData} notebook
 * @returns {Array<String>}
 */
const upstream_of = (a_cell_id, notebook) => Object.values(notebook?.cell_dependencies?.[a_cell_id]?.upstream_cells_map || {}).flatMap((x) => x)

/**
 * @param {String} a_cell_id
 * @param {import("./Editor.js").NotebookData} notebook
 * @param {Function} predicate
 * @param {Set<String>} explored
 * @returns {String | null}
 */
const find_upstream_of = (a_cell_id, notebook, predicate, explored = new Set([])) => {
    if (explored.has(a_cell_id)) return null
    explored.add(a_cell_id)

    if (predicate(a_cell_id)) {
        return a_cell_id
    }

    for (let upstream of upstream_of(a_cell_id, notebook)) {
        const upstream_val = find_upstream_of(upstream, notebook, predicate, explored)
        if (upstream_val !== null) {
            return upstream_val
        }
    }

    return null
}

/**
 * @param {String} flag_name
 * @returns {Function}
 */
const hasTargetBarrier = (flag_name) => {
    return (a_cell_id, notebook) => {
        return notebook?.cell_inputs?.[a_cell_id].metadata[flag_name]
    }
}

const on_jump = (hasBarrier, pluto_actions, cell_id) => () => {
    const notebook = pluto_actions.get_notebook() || {}
    const barrier_cell_id = find_upstream_of(cell_id, notebook, (c) => hasBarrier(c, notebook))
    if (barrier_cell_id !== null) {
        window.dispatchEvent(
            new CustomEvent("cell_focus", {
                detail: {
                    cell_id: barrier_cell_id,
                    line: 0, // 1-based to 0-based index
                },
            })
        )
    }
}

/**
 * @param {{
 *  cell_result: import("./Editor.js").CellResultData,
 *  cell_input: import("./Editor.js").CellInputData,
 *  cell_input_local: { code: String },
 *  cell_dependencies: import("./Editor.js").CellDependencyData
 *  nbpkg: import("./Editor.js").NotebookPkgData?,
 *  selected: boolean,
 *  force_hide_input: boolean,
 *  focus_after_creation: boolean,
 *  process_waiting_for_permission: boolean,
 *  sanitize_html: boolean,
 *  inspecting_hidden_code: boolean,
 *  [key: string]: any,
 * }} props
 * */
export const Cell = ({
    cell_input: { cell_id, code, code_folded, metadata },
    cell_result: { queued, running, runtime, errored, output, logs, published_object_keys, depends_on_disabled_cells, depends_on_skipped_cells },
    cell_dependencies,
    cell_input_local,
    notebook_id,
    selected,
    force_hide_input,
    focus_after_creation,
    is_process_ready,
    disable_input,
    process_waiting_for_permission,
    sanitize_html = true,
    nbpkg,
    global_definition_locations,
    is_first_cell,
    inspecting_hidden_code,
}) => {
    const { show_logs, disabled: running_disabled, skip_as_script } = metadata
    let pluto_actions = useContext(PlutoActionsContext)
    // useCallback because pluto_actions.set_doc_query can change value when you go from viewing a static document to connecting (to binder)
    const on_update_doc_query = useCallback((...args) => pluto_actions.set_doc_query(...args), [pluto_actions])
    const on_focus_neighbor = useCallback((...args) => pluto_actions.focus_on_neighbor(...args), [pluto_actions])
    const on_change = useCallback((val) => pluto_actions.set_local_cell(cell_id, val), [cell_id, pluto_actions])
    const variables = useMemo(() => Object.keys(cell_dependencies?.downstream_cells_map ?? {}), [cell_dependencies])

    // We need to unmount & remount when a destructive error occurs.
    // For that reason, we will use a simple react key and increment it on error
    const [key, setKey] = useState(0)
    const cell_key = useMemo(() => cell_id + key, [cell_id, key])

    const [, resetError] = useErrorBoundary((error) => {
        console.log(`An error occurred in the CodeMirror code, resetting CellInput component. See error below:\n\n${error}\n\n -------------- `)
        setKey(key + 1)
        resetError()
    })

    const remount = useMemo(() => () => setKey(key + 1))
    // cm_forced_focus is null, except when a line needs to be highlighted because it is part of a stack trace
    const [cm_forced_focus, set_cm_forced_focus] = useState(/** @type {any} */ (null))
    const [cm_highlighted_range, set_cm_highlighted_range] = useState(/** @type {{from, to}?} */ (null))
    const [cm_highlighted_line, set_cm_highlighted_line] = useState(null)
    const [cm_diagnostics, set_cm_diagnostics] = useState([])

    useEventListener(
        window,
        "cell_diagnostics",
        (e) => {
            if (e.detail.cell_id === cell_id) {
                set_cm_diagnostics(e.detail.diagnostics)
            }
        },
        [cell_id, set_cm_diagnostics]
    )

    useEventListener(
        window,
        "cell_highlight_range",
        (e) => {
            if (e.detail.cell_id == cell_id && e.detail.from != null && e.detail.to != null) {
                set_cm_highlighted_range({ from: e.detail.from, to: e.detail.to })
            } else {
                set_cm_highlighted_range(null)
            }
        },
        [cell_id]
    )

    useEventListener(
        window,
        "cell_focus",
        useCallback((e) => {
            if (e.detail.cell_id === cell_id) {
                if (e.detail.line != null) {
                    const ch = e.detail.ch
                    if (ch == null) {
                        set_cm_forced_focus([
                            { line: e.detail.line, ch: 0 },
                            { line: e.detail.line, ch: Infinity },
                            { scroll: true, definition_of: e.detail.definition_of },
                        ])
                    } else {
                        set_cm_forced_focus([
                            { line: e.detail.line, ch: ch },
                            { line: e.detail.line, ch: ch },
                            { scroll: true, definition_of: e.detail.definition_of },
                        ])
                    }
                }
            }
        }, [])
    )

    // When you click to run a cell, we use `waiting_to_run` to immediately set the cell's traffic light to 'queued', while waiting for the backend to catch up.
    const [waiting_to_run, set_waiting_to_run] = useState(false)
    useEffect(() => {
        set_waiting_to_run(false)
    }, [queued, running, output?.last_run_timestamp, depends_on_disabled_cells, running_disabled])
    // We activate animations instantly BUT deactivate them NSeconds later.
    // We then toggle animation visibility using opacity. This saves a bunch of repaints.
    const activate_animation = useDebouncedTruth(running || queued || waiting_to_run)

    const class_code_differs = code !== (cell_input_local?.code ?? code)
    const no_output_yet = (output?.last_run_timestamp ?? 0) === 0
    const code_not_trusted_yet = process_waiting_for_permission && no_output_yet

    // When reading the code in a static HTML preview
    const [inspecting_hidden_code_here, set_inspecting_hidden_code_here] = useState(false)
    useEffect(() => {
        if (!inspecting_hidden_code) set_inspecting_hidden_code_here(false)
    }, [inspecting_hidden_code])

    // during the initial page load, force_hide_input === true, so that cell outputs render fast, and codemirrors are loaded after
    let show_input =
        !force_hide_input && (code_not_trusted_yet || errored || class_code_differs || cm_forced_focus != null || !code_folded || inspecting_hidden_code_here)

    const [line_heights, set_line_heights] = useState([15])
    const node_ref = useRef(/** @type {HTMLElement?} */ (null))

    const disable_input_ref = useRef(disable_input)
    disable_input_ref.current = disable_input
    const should_set_waiting_to_run_ref = useRef(true)
    should_set_waiting_to_run_ref.current = !running_disabled && !depends_on_disabled_cells
    useEventListener(
        window,
        "set_waiting_to_run_smart",
        (e) => {
            if (e.detail.cell_ids.includes(cell_id)) set_waiting_to_run(should_set_waiting_to_run_ref.current)
        },
        [cell_id, set_waiting_to_run]
    )

    const cell_api_ready = useCellApi(node_ref, published_object_keys, pluto_actions)
    const on_delete = useCallback(() => {
        pluto_actions.confirm_delete_multiple(pluto_actions.get_selected_cells(cell_id, selected))
    }, [pluto_actions, selected, cell_id])
    const on_submit = useCallback(() => {
        if (!disable_input_ref.current) {
            pluto_actions.set_and_run_multiple([cell_id])
        }
    }, [pluto_actions, cell_id])
    const on_change_cell_input = useCallback(
        (new_code) => {
            if (!disable_input_ref.current) {
                if (code_folded && cm_forced_focus != null) {
                    pluto_actions.fold_remote_cells([cell_id], false)
                }
                on_change(new_code)
            }
        },
        [code_folded, cm_forced_focus, pluto_actions, on_change]
    )
    const on_add_after = useCallback(() => {
        pluto_actions.add_remote_cell(cell_id, "after")
    }, [pluto_actions, cell_id, selected])
    const on_code_fold = useCallback(() => {
        if (inspecting_hidden_code) {
            set_inspecting_hidden_code_here(!inspecting_hidden_code_here)
        } else {
            pluto_actions.fold_remote_cells(pluto_actions.get_selected_cells(cell_id, selected), !code_folded)
        }
    }, [pluto_actions, cell_id, selected, code_folded, inspecting_hidden_code_here, inspecting_hidden_code])
    const on_run = useCallback(() => {
        pluto_actions.set_and_run_multiple(pluto_actions.get_selected_cells(cell_id, selected))
    }, [pluto_actions, cell_id, selected])
    const set_show_logs = useCallback(
        (show_logs) =>
            pluto_actions.update_notebook((notebook) => {
                notebook.cell_inputs[cell_id].metadata.show_logs = show_logs
            }),
        [pluto_actions, cell_id]
    )
    const set_cell_disabled = useCallback(
        async (new_val) => {
            await pluto_actions.update_notebook((notebook) => {
                notebook.cell_inputs[cell_id].metadata["disabled"] = new_val
            })
            // we also 'run' the cell if it is disabled, this will make the backend propage the disabled state to dependent cells
            await on_submit()
        },
        [pluto_actions, cell_id, on_submit]
    )

    const any_logs = useMemo(() => !_.isEmpty(logs), [logs])

    const skip_as_script_jump = useCallback(on_jump(hasTargetBarrier("skip_as_script"), pluto_actions, cell_id), [pluto_actions, cell_id])
    const disabled_jump = useCallback(on_jump(hasTargetBarrier("disabled"), pluto_actions, cell_id), [pluto_actions, cell_id])

    return html`
        <pluto-cell
            key=${cell_key}
            ref=${node_ref}
            class=${cl({
                queued: queued || (waiting_to_run && is_process_ready),
                internal_test_queued: !is_process_ready && (queued || waiting_to_run),
                running,
                activate_animation,
                errored,
                selected,
                code_differs: class_code_differs,
                code_folded,
                inspecting_hidden_code: code_folded && inspecting_hidden_code_here,
                skip_as_script,
                running_disabled,
                depends_on_disabled_cells,
                depends_on_skipped_cells,
                show_input,
                shrunk: Object.values(logs).length > 0,
                hooked_up: output?.has_pluto_hook_features ?? false,
                no_output_yet,
            })}
            id=${cell_id}
        >
            ${variables.map((name) => html`<span id=${encodeURI(name)} />`)}
            <button
                onClick=${() => {
                    pluto_actions.add_remote_cell(cell_id, "before")
                }}
                class="add_cell before"
                title=${t("t_add_cell", { key: "Ctrl + Enter" })}
                tabindex=${is_first_cell ? undefined : "-1"}
            >
                <span></span>
            </button>
            <pluto-shoulder draggable="true" title=${t("t_drag_to_move_cell")}>
                <button onClick=${on_code_fold} class="foldcode" title=${t("t_show_hide_code")}>
                    <span></span>
                </button>
            </pluto-shoulder>
            <pluto-trafficlight></pluto-trafficlight>
            ${code_not_trusted_yet
                ? html`<${SafePreviewOutput} />`
                : cell_api_ready
                  ? html`<${CellOutput} errored=${errored} ...${output} sanitize_html=${sanitize_html} cell_id=${cell_id} />`
                  : html``}
            <${CellInput}
                local_code=${cell_input_local?.code ?? code}
                remote_code=${code}
                global_definition_locations=${global_definition_locations}
                disable_input=${disable_input}
                focus_after_creation=${focus_after_creation}
                cm_forced_focus=${cm_forced_focus}
                set_cm_forced_focus=${set_cm_forced_focus}
                show_input=${show_input}
                skip_static_fake=${is_first_cell}
                on_submit=${on_submit}
                on_delete=${on_delete}
                on_add_after=${on_add_after}
                on_change=${on_change_cell_input}
                on_update_doc_query=${on_update_doc_query}
                on_focus_neighbor=${on_focus_neighbor}
                on_line_heights=${set_line_heights}
                nbpkg=${nbpkg}
                cell_id=${cell_id}
                notebook_id=${notebook_id}
                metadata=${metadata}
                any_logs=${any_logs}
                show_logs=${show_logs}
                set_show_logs=${set_show_logs}
                set_cell_disabled=${set_cell_disabled}
                cm_highlighted_line=${cm_highlighted_line}
                cm_highlighted_range=${cm_highlighted_range}
                cm_diagnostics=${cm_diagnostics}
                onerror=${remount}
            />
            ${show_logs && cell_api_ready
                ? html`<${Logs}
                      logs=${Object.values(logs)}
                      line_heights=${line_heights}
                      set_cm_highlighted_line=${set_cm_highlighted_line}
                      sanitize_html=${sanitize_html}
                  />`
                : null}
            <${RunArea}
                cell_id=${cell_id}
                running_disabled=${running_disabled}
                depends_on_disabled_cells=${depends_on_disabled_cells}
                on_run=${on_run}
                on_interrupt=${() => {
                    pluto_actions.interrupt_remote(cell_id)
                }}
                set_cell_disabled=${set_cell_disabled}
                runtime=${runtime}
                running=${running}
                code_differs=${class_code_differs}
                queued=${queued}
                on_jump=${disabled_jump}
            />
            <button
                onClick=${() => {
                    pluto_actions.add_remote_cell(cell_id, "after")
                }}
                class="add_cell after"
                title=${t("t_add_cell", { key: "Ctrl + Enter" })}
            >
                <span></span>
            </button>
            ${skip_as_script
                ? html`<div
                      class="skip_as_script_marker"
                      title=${t("t_cell_disabled_in_file_tooltip")}
                      onClick=${(e) => {
                          open_pluto_popup({
                              type: "info",
                              source_element: e.target,
                              body: th("t_cell_disabled_in_file_explanation"),
                          })
                      }}
                  ></div>`
                : depends_on_skipped_cells
                  ? html`<div
                        class="depends_on_skipped_marker"
                        title=${t("t_cell_indirectly_disabled_in_file_tooltip")}
                        onClick=${(e) => {
                            open_pluto_popup({
                                type: "info",
                                source_element: e.target,
                                body: th("t_cell_indirectly_disabled_in_file_explanation", {
                                    upstreamLink: html`<span onClick=${skip_as_script_jump} style="cursor: pointer; text-decoration: underline">
                                        ${t("t_cell_upstreamLink")}</span
                                    >`,
                                }),
                            })
                        }}
                    ></div>`
                  : null}
        </pluto-cell>
    `
}
/**
 * @param {{
 *  cell_result: import("./Editor.js").CellResultData,
 *  cell_input: import("./Editor.js").CellInputData,
 *  [key: string]: any,
 * }} props
 * */
export const IsolatedCell = ({ cell_input: { cell_id, metadata }, cell_result: { logs, output, published_object_keys }, hidden, sanitize_html = true }) => {
    const node_ref = useRef(/** @type {HTMLElement?} */ (null))
    let pluto_actions = useContext(PlutoActionsContext)
    const cell_api_ready = useCellApi(node_ref, published_object_keys, pluto_actions)
    const { show_logs } = metadata

    return html`
        <pluto-cell ref=${node_ref} id=${cell_id} class=${hidden ? "hidden-cell" : "isolated-cell"}>
            ${cell_api_ready ? html`<${CellOutput} ...${output} sanitize_html=${sanitize_html} cell_id=${cell_id} />` : html``}
            ${show_logs ? html`<${Logs} logs=${Object.values(logs)} line_heights=${[15]} set_cm_highlighted_line=${() => {}} />` : null}
        </pluto-cell>
    `
}
