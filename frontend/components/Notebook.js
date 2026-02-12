import { t } from "../common/lang.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { html, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "../imports/Preact.js"

import { Cell } from "./Cell.js"
import { nbpkg_fingerprint } from "./PkgStatusMark.js"

/** Like `useMemo`, but explain to the console what invalidated the memo. */
export const useMemoDebug = (fn, args) => {
    const last_values = useRef(args)
    return useMemo(() => {
        const new_values = args
        console.group("useMemoDebug: something changed!")
        if (last_values.current.length !== new_values.length) {
            console.log("Length changed. ", " old ", last_values.current, " new ", new_values)
        } else {
            for (let i = 0; i < last_values.current.length; i++) {
                if (last_values.current[i] !== new_values[i]) {
                    console.log("Element changed. Index: ", i, " old ", last_values.current[i], " new ", new_values[i])
                }
            }
        }
        console.groupEnd()
        return fn()
    }, args)
}

const CellMemo = ({
    cell_result,
    cell_input,
    cell_input_local,
    notebook_id,
    cell_dependencies,
    selected,
    focus_after_creation,
    force_hide_input,
    is_process_ready,
    disable_input,
    sanitize_html = true,
    process_waiting_for_permission,
    show_logs,
    set_show_logs,
    nbpkg,
    global_definition_locations,
    is_first_cell,
    inspecting_hidden_code,
}) => {
    const { body, last_run_timestamp, mime, persist_js_state, rootassignee } = cell_result?.output || {}
    const { queued, running, runtime, errored, depends_on_disabled_cells, logs, depends_on_skipped_cells } = cell_result || {}
    const { cell_id, code, code_folded, metadata } = cell_input || {}
    return useMemo(() => {
        return html`
            <${Cell}
                cell_result=${cell_result}
                cell_dependencies=${cell_dependencies}
                cell_input=${cell_input}
                cell_input_local=${cell_input_local}
                notebook_id=${notebook_id}
                selected=${selected}
                force_hide_input=${force_hide_input}
                focus_after_creation=${focus_after_creation}
                is_process_ready=${is_process_ready}
                disable_input=${disable_input}
                process_waiting_for_permission=${process_waiting_for_permission}
                sanitize_html=${sanitize_html}
                nbpkg=${nbpkg}
                global_definition_locations=${global_definition_locations}
                is_first_cell=${is_first_cell}
                inspecting_hidden_code=${inspecting_hidden_code}
            />
        `
    }, [
        // Object references may invalidate this faster than the optimal. To avoid this, spread out objects to primitives!
        cell_id,
        ...Object.keys(metadata),
        ...Object.values(metadata),
        depends_on_disabled_cells,
        depends_on_skipped_cells,
        queued,
        running,
        runtime,
        errored,
        body,
        last_run_timestamp,
        mime,
        persist_js_state,
        rootassignee,
        logs,
        code,
        code_folded,
        cell_input_local,
        notebook_id,
        cell_dependencies,
        selected,
        force_hide_input,
        focus_after_creation,
        is_process_ready,
        disable_input,
        process_waiting_for_permission,
        sanitize_html,
        ...nbpkg_fingerprint(nbpkg),
        global_definition_locations,
        is_first_cell,
        inspecting_hidden_code,
    ])
}

/**
 * Rendering cell outputs can slow down the initial page load, so we delay rendering them using this heuristic function to determine the length of the delay (as a function of the number of cells in the notebook). Since using CodeMirror 6, cell inputs do not cause a slowdown when out-of-viewport, rendering is delayed until they come into view.
 * @param {Number} num_cells
 */
const render_cell_outputs_delay = (num_cells) => (num_cells > 20 ? 100 : 0)
/**
 * The first <x> cells will bypass the {@link render_cell_outputs_delay} heuristic and render directly.
 */
const render_cell_outputs_minimum = 20

/**
 * @param {{
 *  notebook: import("./Editor.js").NotebookData,
 *  cell_inputs_local: { [uuid: string]: { code: String } },
 *  on_update_doc_query: any,
 *  on_cell_input: any,
 *  on_focus_neighbor: any,
 *  last_created_cell: string,
 *  selected_cells: Array<string>,
 *  is_initializing: boolean,
 *  is_process_ready: boolean,
 *  disable_input: boolean,
 *  process_waiting_for_permission: boolean,
 *  sanitize_html: boolean,
 *  inspecting_hidden_code: boolean,
 * }} props
 * */
export const Notebook = ({
    notebook,
    cell_inputs_local,
    last_created_cell,
    selected_cells,
    is_initializing,
    is_process_ready,
    disable_input,
    process_waiting_for_permission,
    sanitize_html = true,
    inspecting_hidden_code,
}) => {
    let pluto_actions = useContext(PlutoActionsContext)

    // Add new cell when the last cell gets deleted
    useEffect(() => {
        // This might look kinda silly...
        // and it is... but it covers all the cases... - DRAL
        if (notebook.cell_order.length === 0 && !is_initializing) {
            pluto_actions.add_remote_cell_at(0)
        }
    }, [is_initializing, notebook.cell_order.length])

    // Only render the notebook partially during the first few seconds
    const [cell_outputs_delayed, set_cell_outputs_delayed] = useState(true)

    useEffect(() => {
        if (cell_outputs_delayed && notebook.cell_order.length > 0) {
            setTimeout(() => {
                set_cell_outputs_delayed(false)
            }, render_cell_outputs_delay(notebook.cell_order.length))
        }
    }, [cell_outputs_delayed, notebook.cell_order.length])

    let global_definition_locations = useMemo(
        () =>
            Object.fromEntries(
                Object.values(notebook?.cell_dependencies ?? {}).flatMap((x) =>
                    Object.keys(x.downstream_cells_map)
                        .filter((variable) => !variable.includes("."))
                        .map((variable) => [variable, x.cell_id])
                )
            ),
        [notebook?.cell_dependencies]
    )

    useLayoutEffect(() => {
        let oldhash = window.location.hash
        if (oldhash.length > 1) {
            let go = () => {
                window.location.hash = "#"
                window.location.hash = oldhash
            }
            go()
            // Scrolling there might trigger some codemirrors to render and change height, so let's do it again.
            requestIdleCallback(go)
        }
    }, [cell_outputs_delayed])

    return html`
        <pluto-notebook id=${notebook.notebook_id}>
            ${notebook.cell_order
                .filter((_, i) => !(cell_outputs_delayed && i > render_cell_outputs_minimum))
                .map(
                    (cell_id, i) =>
                        html`<${CellMemo}
                            key=${cell_id}
                            cell_result=${notebook.cell_results[cell_id] ?? {
                                cell_id: cell_id,
                                queued: true,
                                running: false,
                                errored: false,
                                runtime: null,
                                output: null,
                                logs: [],
                            }}
                            cell_input=${notebook.cell_inputs[cell_id]}
                            cell_dependencies=${notebook?.cell_dependencies?.[cell_id] ?? {}}
                            cell_input_local=${cell_inputs_local[cell_id]}
                            notebook_id=${notebook.notebook_id}
                            selected=${selected_cells.includes(cell_id)}
                            focus_after_creation=${last_created_cell === cell_id}
                            force_hide_input=${false}
                            is_process_ready=${is_process_ready}
                            disable_input=${disable_input}
                            process_waiting_for_permission=${process_waiting_for_permission}
                            sanitize_html=${sanitize_html}
                            nbpkg=${notebook.nbpkg}
                            global_definition_locations=${global_definition_locations}
                            is_first_cell=${i === 0}
                            inspecting_hidden_code=${inspecting_hidden_code}
                        />`
                )}
            ${
                // Waiting for the last deleted cell to be recovered...
                notebook.cell_order.length === 0 ||
                // Waiting for all cells to be displayed...
                (cell_outputs_delayed && notebook.cell_order.length >= render_cell_outputs_minimum)
                    ? html`<div
                          style="
                        font-family: system-ui;
                        font-style: italic;
                        padding: 0.3rem 1rem;
                        margin: 1rem 0rem;
                        border-radius: .3rem;
                        background: var(--blockquote-bg);
                        opacity: 0.6;
                        animation: fadeintext .2s 1.5s linear;
                        animation-fill-mode: both;
                        margin-bottom: ${Math.max(0, (notebook.cell_order.length - render_cell_outputs_minimum) * 10)}rem;"
                      >
                          ${t("t_loading_cells")}
                      </div>`
                    : null
            }
        </pluto-notebook>
    `
}
