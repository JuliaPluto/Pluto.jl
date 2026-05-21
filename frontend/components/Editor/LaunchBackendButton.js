import { html, useMemo, useEffect } from "../../imports/Preact.js"
import * as preact from "../../imports/Preact.js"
import { RunLocalButton, BinderButton } from "../EditOrRunButton.js"
import { start_local } from "../../common/RunLocal.js"
import { BackendLaunchPhase, start_binder } from "../../common/Binder.js"
import immer, { applyPatches, produceWithPatches } from "../../imports/immer.js"
import _ from "../../imports/lodash-es.js"
import { open_pluto_popup } from "../../common/open_pluto_popup.js"
import { th } from "../../common/lang.js"

/**
 * @param {{
 *  editor: import("../Editor.js").Editor,
 *  launch_params: import("../Editor.js").LaunchParameters,
 *  status: Record<string, boolean>,
 * }} props
 */
const EditorLaunchBackendButton = ({ editor, launch_params, status }) => {
    try {
        const EnvRun = useMemo(
            // @ts-ignore
            () => window?.pluto_injected_environment?.environment?.({ client: editor.client, editor, imports: { immer, preact } })?.custom_run_or_edit,
            [editor.client, editor]
        )
        // @ts-ignore
        if (window?.pluto_injected_environment?.provides_backend) {
            // @ts-ignore
            return html`<${EnvRun} editor=${editor} backend_phases=${BackendLaunchPhase} launch_params=${launch_params} />`
            // Don't allow a misconfigured environment to stop offering other backends
        }
    } catch (e) {}
    if (status == null) return null
    if (status.offer_local)
        return html`<${RunLocalButton}
            start_local=${() =>
                start_local({
                    setStatePromise: editor.setStatePromise,
                    connect: editor.connect,
                    launch_params: launch_params,
                })}
        />`

    if (status.offer_binder)
        return html`<${BinderButton}
            offer_binder=${status.offer_binder}
            start_binder=${() =>
                start_binder({
                    setStatePromise: editor.setStatePromise,
                    connect: editor.connect,
                    launch_params: launch_params,
                })}
            notebookfile=${launch_params.notebookfile == null ? null : new URL(launch_params.notebookfile, window.location.href).href}
            notebook=${editor.state.notebook}
        />`

    return null
}

export const ViewCodeOrLaunchBackendButtons = ({ editor, launch_params, status }) => {
    return html`<div class="edit_or_run">
        <${EditorLaunchBackendButton} editor=${editor} launch_params=${launch_params} status=${status} />

        <${ViewCodeButton} editor=${editor} launch_params=${launch_params} status=${status} />
    </div>`
}

/**
 * @param {{
 *  editor: import("../Editor.js").Editor,
 *  launch_params: import("../Editor.js").LaunchParameters,
 *  status: Record<string, boolean>,
 * }} props
 */
const ViewCodeButton = ({ editor, launch_params, status }) => {
    const enabled = (() => {
        if (!status.static_preview) return false
        const blf = editor.state.backend_launch_phase
        if (blf != null && blf !== BackendLaunchPhase.wait_for_user) return false

        const any_folded_cells = Object.values(editor.state.notebook.cell_inputs).some((cell) => cell.code_folded)
        if (!any_folded_cells) return false

        return true
    })()

    useEffect(() => {
        if (!enabled) editor.setState({ inspecting_hidden_code: false })
    }, [enabled])

    if (!enabled) return null

    const current = editor.state.inspecting_hidden_code
    return html`
        <button
            class=${current ? "view_hidden_code_cancel" : "view_hidden_code"}
            title=${current ? "Cancel" : "Read hidden code"}
            onClick=${(e) => {
                editor.setState({ inspecting_hidden_code: !current })
                if (!current) show_inspecting_code_info(e, editor)
            }}
        >
            <span class="yayicon"></span>
            <span class="text">${th(current ? "t_edit_or_run_view_code_cancel" : "t_edit_or_run_view_code")}</span>
        </button>
    `
}

const show_inspecting_code_info = (e, editor) => {
    // Find the closest "show code" button, scroll to it, and open a popup with information.

    setTimeout(() => {
        if (!editor.state.inspecting_hidden_code) return
        const all_buttons = [...e.target.closest("pluto-editor").querySelectorAll("pluto-cell.code_folded > pluto-shoulder > button")]

        const viewportTop = 0
        const viewportBottom = window.innerHeight || document.documentElement.clientHeight
        const viewportCenter = (viewportTop + viewportBottom) / 2

        const vs = all_buttons.map((btn) => {
            const rect = btn.getBoundingClientRect()
            const elementCenter = (rect.top + rect.bottom) / 2
            const distance = Math.abs(elementCenter - viewportCenter)
            return { btn, distance }
        })

        const closest = _.first(_.sortBy(vs, "distance"))
        if (closest == null) return

        closest.btn.closest("pluto-cell").scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
        setTimeout(() => {
            if (!editor.state.inspecting_hidden_code) return
            open_pluto_popup({
                type: "info",
                body: html`← Click on this icon to read hidden code.`,
                source_element: closest.btn,
                // should_focus: true,
            })
        }, 600)
    }, 200)
}
