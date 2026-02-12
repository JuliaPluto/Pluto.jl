import { t } from "../common/lang.js"
import _ from "../imports/lodash.js"
import { html, useContext, useEffect, useMemo, useState } from "../imports/Preact.js"
import { useDelayedTruth } from "./BottomRightPanel.js"
import { scroll_cell_into_view } from "./Scroller.js"

/**
 * @param {{
 * notebook: import("./Editor.js").NotebookData,
 * backend_launch_phase: number?,
 * status: Record<string,any>,
 * }} props
 */
export const ProgressBar = ({ notebook, backend_launch_phase, status }) => {
    const [recently_running, set_recently_running] = useState(/** @type {string[]} */ ([]))
    const [currently_running, set_currently_running] = useState(/** @type {string[]} */ ([]))

    useEffect(
        () => {
            const currently = Object.values(notebook.cell_results)
                .filter((c) => c.running || c.queued)
                .map((c) => c.cell_id)

            set_currently_running(currently)

            if (currently.length === 0) {
                // all cells completed
                set_recently_running([])
            } else {
                // add any new running cells to our pile
                set_recently_running(_.union(currently, recently_running))
            }
        },
        Object.values(notebook.cell_results).map((c) => c.running || c.queued)
    )

    let cell_progress = recently_running.length === 0 ? 0 : 1 - Math.max(0, currently_running.length - 0.3) / recently_running.length

    let binder_loading = status.loading && status.binder
    let progress = binder_loading ? (backend_launch_phase ?? 0) : cell_progress

    const anything = (binder_loading || recently_running.length !== 0) && progress !== 1
    // Double inversion with ! to short-circuit the true, not the false
    const anything_for_a_short_while = !useDelayedTruth(!anything, 500)
    const anything_for_a_long_while = !useDelayedTruth(!anything, 2000)

    if (!(anything || anything_for_a_short_while || anything_for_a_long_while)) {
        return null
    }

    // set to 1 when all cells completed, instead of moving the progress bar to the start
    if (anything_for_a_short_while && !(binder_loading || recently_running.length !== 0)) {
        progress = 1
    }

    const title = binder_loading
        ? t("t_process_status_loading_binder")
        : t("t_process_running_cells", {
              done: recently_running.length - currently_running.length,
              total: recently_running.length,
          })

    return html`<loading-bar
        class=${binder_loading ? "slow" : "fast"}
        style=${`
            width: ${100 * progress}vw; 
            opacity: ${anything && anything_for_a_short_while ? 1 : 0};
            ${anything || anything_for_a_short_while ? "" : "transition: none;"}
            pointer-events: ${anything ? "auto" : "none"};
            cursor: ${!binder_loading && anything ? "pointer" : "auto"};
        `}
        onClick=${(e) => {
            if (!binder_loading) {
                scroll_to_busy_cell(notebook)
            }
        }}
        aria-hidden="true"
        title=${title}
    ></loading-bar>`
}

export const scroll_to_busy_cell = (notebook) => {
    const running_cell_id =
        notebook == null
            ? (document.querySelector("pluto-cell.running") ?? document.querySelector("pluto-cell.queued"))?.id
            : (Object.values(notebook.cell_results).find((c) => c.running) ?? Object.values(notebook.cell_results).find((c) => c.queued))?.cell_id
    if (running_cell_id) {
        scroll_cell_into_view(running_cell_id)
    }
}
