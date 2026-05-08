import { html, useEffect, useMemo, useState } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

//@ts-ignore
import { useDialog } from "../common/useDialog.js"
import { useEventListener } from "../common/useEventListener.js"
import { t, th } from "../common/lang.js"
import { downstream_recursive } from "../common/SliderServerClient.js"
import { pretty_long_time } from "./EditOrRunButton.js"
import { and, ctrl_or_cmd_name } from "../common/KeyboardShortcuts.js"
import { useMillisSinceTruthy } from "./RunArea.js"
import { cl } from "../common/ClassTable.js"

const long_threshold_seconds = 40
const auto_accept_after_seconds = 20

/**
 * @typedef ConfirmEventData
 * @property {string[]} cell_ids
 * @property {number} num_dependencies
 * @property {number} time
 * @property {(result: boolean) => void} on_result
 */

/**
 *
 * @param {import("./Editor.js").NotebookData} notebook
 * @param {string[]} cell_ids
 * @returns {Promise<boolean>}
 */
export const maybe_abort_long_runtime = async (notebook, cell_ids) => {
    const include_roots = true

    const found_downstream = downstream_recursive(notebook.cell_dependencies, cell_ids, { recursive: true })[include_roots ? "union" : "difference"](
        new Set(cell_ids)
    )

    const runtimes = [...found_downstream].map((id) => (notebook.cell_results[id]?.runtime ?? 0) / 1e9)

    const total_runtime = _.sum(runtimes)
    if (total_runtime > long_threshold_seconds) {
        const confirmed = await new Promise((resolve) => {
            window.dispatchEvent(
                new CustomEvent("confirm before long runtime", {
                    detail: /** @type {ConfirmEventData} */ ({
                        cell_ids,
                        num_dependencies: found_downstream.difference(new Set(cell_ids)).size,
                        time: total_runtime,
                        on_result: (result) => resolve(result),
                    }),
                })
            )
        })
        return !confirmed
    }

    return false
}

/**
 * @template T
 * @param {T[]} arr
 */
const pickrandom = (arr) => /** @type {T} */ (arr[Math.floor(Math.random() * arr.length)])

/**
 * @param {{
 * }} props
 * */
export const ConfirmBeforeLongRuntime = ({}) => {
    const [dialog_ref, open, close, _toggle, currently_open] = useDialog()
    const [open_event_detail, set_open_event_detail] = useState(/** @type {ConfirmEventData | undefined} */ (undefined))
    const [will_auto_accept, set_will_auto_accept] = useState(true)

    const { cell_ids, num_dependencies, time, on_result } = open_event_detail ?? {}
    const send_result = (result) => {
        if (typeof on_result === "function") {
            on_result(result)
        }
    }

    useEffect(() => {
        const reduced_motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        set_will_auto_accept(!reduced_motion)
    }, [open_event_detail])

    useEventListener(
        document,
        "focusout",
        () => {
            set_will_auto_accept(false)
        },
        [set_will_auto_accept]
    )

    useEventListener(
        window,
        "confirm before long runtime",
        (/** @type {CustomEvent} */ e) => {
            set_open_event_detail(e.detail)
            open()
        },
        [open, set_open_event_detail]
    )

    useEffect(() => {
        // If the dialog gets closed (e.g. by the user pressing Esc)
        if (!currently_open && typeof on_result === "function") {
            on_result(false)
        }
    }, [currently_open])

    const open_time = (useMillisSinceTruthy(currently_open) ?? 0) / 1e3

    if (will_auto_accept && open_time > auto_accept_after_seconds) {
        send_result(true)
        close()
    }

    const _has_deps = (num_dependencies ?? 0) > 0
    const _has_single_root = cell_ids?.length === 1
    const possible_hints = Object.entries({
        t_confirm_run_many_cells_bonus_a: _has_single_root && _has_deps,
        t_confirm_run_many_cells_bonus_b: _has_deps,
    })
        .filter(([_, condition]) => condition)
        .map(([key]) => key)

    const current_hint = useMemo(() => pickrandom(possible_hints), [open_event_detail])

    return html`<dialog ref=${dialog_ref} class="pluto-modal confirm-before-long-runtime">
        <div class="ple-download ple-option">
            <p>
                ${th(cell_ids?.length === 1 ? "t_confirm_run_many_cells_single_root" : "t_confirm_run_many_cells_multiple_roots", {
                    roots: cell_ids?.length ?? 0,
                    count: num_dependencies ?? 0,
                    time: html`<strong>${pretty_long_time(time ?? 0)}</strong>`,
                })}
            </p>
            ${possible_hints.length > 0
                ? html`<p class="bonus-info">
                      ${th(current_hint, {
                          submit_all_changes: html`<kbd>${ctrl_or_cmd_name}</kbd>${and}<kbd>S</kbd>`,
                          disable_cell: html`<a href="https://plutojl.org/en/docs/disable-cell/" target="_blank"
                              ><strong>${t("t_disable_cell_action")}</strong></a
                          >`,
                      })}
                  </p>`
                : null}
        </div>
        <div class="final">
            <button class="final-no" onClick=${close} aria-label=${t("t_no")}>${th("t_no_key", { key: html`<kbd aria-hidden="true">Esc</kbd>` })}</button>
            <button
                style="--auto-click-progress: ${will_auto_accept ? open_time / (auto_accept_after_seconds * 0.8) : 0}"
                class=${cl({ "final-yes": true, "will-auto-accept": will_auto_accept })}
                autofocus
                onClick=${() => {
                    send_result(true)
                    close()
                }}
                aria-label=${t("t_yes")}
            >
                <span> ${th("t_yes_key", { key: html`<kbd aria-hidden="true">Enter</kbd>` })} </span>
            </button>
        </div>
    </dialog>`
}
