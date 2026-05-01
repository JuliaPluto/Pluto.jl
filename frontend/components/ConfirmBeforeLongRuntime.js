import { html, useEffect, useState } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

//@ts-ignore
import { useDialog } from "../common/useDialog.js"
import { useEventListener } from "../common/useEventListener.js"
import { t, th } from "../common/lang.js"
import { exportNotebookDesktop, WarnForVisisblePasswords } from "./ExportBanner.js"
import { useMillisSinceTruthy } from "./RunArea.js"
import { cl } from "../common/ClassTable.js"
import { downstream_recursive } from "../common/SliderServerClient.js"
import { pretty_long_time } from "./EditOrRunButton.js"

const long_threshold_seconds = 60

/**
 * @typedef ConfirmEventData
 * @property {number} count
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

    console.log({ l: found_downstream.size, s: _.sum(runtimes), runtimes, found_downstream })

    const total_runtime = _.sum(runtimes)
    if (total_runtime > long_threshold_seconds) {
        const confirmed = await new Promise((resolve) => {
            window.dispatchEvent(
                new CustomEvent("confirm before long runtime", {
                    detail: /** @type {ConfirmEventData} */ ({
                        count: found_downstream.size,
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
 * @param {{
 * }} props
 * */
export const ConfirmBeforeLongRuntime = ({}) => {
    const [dialog_ref, open, close, _toggle, currently_open] = useDialog()
    const [open_event_detail, set_open_event_detail] = useState(/** @type {ConfirmEventData | undefined} */ (undefined))

    const { count, time, on_result } = open_event_detail ?? {}
    const send_result = (result) => {
        if (typeof on_result === "function") {
            on_result(result)
        }
    }

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
        if (!currently_open && typeof on_result === "function") {
            on_result(false)
        }
    }, [currently_open, on_result])

    // const open_time = useMillisSinceTruthy(currently_open)

    // TODO: separate message if the root has multiple cells
    return html`<dialog ref=${dialog_ref} class="pluto-modal confirm-before-long-runtime">
        <div class="ple-download ple-option">
            <p>
                ${th("t_confirm_run_many_cells", {
                    count,
                    time: html`<strong>${pretty_long_time(time ?? 0)}</strong>`,
                })}
            </p>
        </div>
        <div class="final">
            <button class="final-no" onClick=${close} aria-label=${t("t_no")}>${th("t_no_key", { key: html`<kbd>Esc</kbd>` })}</button>
            <button
                class="final-yes"
                autofocus
                onClick=${() => {
                    send_result(true)
                    close()
                }}
                aria-label=${t("t_yes")}
            >
                ${th("t_yes_key", { key: html`<kbd>Enter</kbd>` })}
            </button>
        </div>
    </dialog>`
}
