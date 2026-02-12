import { is_desktop } from "../components/DesktopInterface.js"
import immer from "../imports/immer.js"
import { BackendLaunchPhase } from "./Binder.js"
import { timeout_promise } from "./PlutoConnection.js"
import { with_query_params } from "./URLTools.js"

// This file is very similar to `start_binder` in Binder.js

/**
 *
 * @param {{
 *  launch_params: import("../components/Editor.js").LaunchParameters,
 *  setStatePromise: any,
 *  connect: () => Promise<void>,
 * }} props
 */
export const start_local = async ({ setStatePromise, connect, launch_params }) => {
    try {
        if (launch_params.pluto_server_url == null || launch_params.notebookfile == null) throw Error("Invalid launch parameters for starting locally.")

        await setStatePromise(
            immer((/** @type {import("../components/Editor.js").EditorState} */ state) => {
                state.backend_launch_phase = BackendLaunchPhase.responded
                state.disable_ui = false
                // Clear the Status of the process that generated the HTML
                state.notebook.status_tree = null
            })
        )

        const with_token = (x) => String(x)
        const binder_session_url = new URL(launch_params.pluto_server_url, window.location.href)

        let open_response

        // We download the notebook file contents, and then upload them to the Pluto server.
        const notebook_contents = await (
            await fetch(new Request(launch_params.notebookfile, { integrity: launch_params.notebookfile_integrity ?? undefined }))
        ).arrayBuffer()

        open_response = await fetch(
            with_token(
                with_query_params(
                    new URL(with_query_params("notebookupload", Object.fromEntries(binder_session_url.searchParams.entries())), binder_session_url),
                    {
                        name: new URLSearchParams(window.location.search).get("name"),
                        clear_frontmatter: "yesplease",
                        execution_allowed: "yepperz",
                    }
                )
            ),
            {
                method: "POST",
                body: notebook_contents,
            }
        )

        if (!open_response.ok) {
            let b = await open_response.blob()
            window.location.href = URL.createObjectURL(b)
            return
        }

        const new_notebook_id = await open_response.text()
        const edit_url = with_query_params(new URL("edit", binder_session_url), { id: new_notebook_id })
        console.info("notebook_id:", new_notebook_id)

        if (!is_desktop()) {
            window.history.replaceState({}, "", edit_url)
        }

        await setStatePromise(
            immer((/** @type {import("../components/Editor.js").EditorState} */ state) => {
                state.notebook.notebook_id = new_notebook_id
                state.backend_launch_phase = BackendLaunchPhase.notebook_running
            })
        )
        console.log("Connecting WebSocket")

        const connect_promise = connect()
        await timeout_promise(connect_promise, 20_000).catch((e) => {
            console.error("Failed to establish connection within 20 seconds. Navigating to the edit URL directly.", e)

            window.parent.location.href = with_token(edit_url)
        })
    } catch (err) {
        console.error("Failed to initialize binder!", err)
        alert("Something went wrong! 😮\n\nWe failed to open this notebook. Please try again with a different browser, or come back later.")
    }
}
