import { html, render, useEffect, useRef, useState } from "./imports/Preact.js"
import "./common/NodejsCompatibilityPolyfill.js"

import { Editor, default_path } from "./components/Editor.js"
import { FetchProgress, read_Uint8Array_with_progress } from "./components/FetchProgress.js"
import { unpack } from "./common/MsgPack.js"
import { RawHTMLContainer } from "./components/CellOutput.js"
import { ProcessStatus } from "./common/ProcessStatus.js"
import { parse_launch_params } from "./common/parse_launch_params.js"

const url_params = new URLSearchParams(window.location.search)

//////////////
// utils:

const set_attribute_if_needed = (element, attr, value) => {
    if (element.getAttribute(attr) !== value) {
        element.setAttribute(attr, value)
    }
}
export const set_disable_ui_css = (/** @type {boolean} */ val, /** @type {HTMLElement} */ element) => {
    element.classList.toggle("disable_ui", val)
}
export const is_editor_embedded_inside_editor = (/** @type {HTMLElement} */ element) => element.parentElement?.closest("pluto-editor") != null

/////////////
// the rest:

const launch_params = parse_launch_params()

const truthy = (x) => x === "" || x === "true"
const falsey = (x) => x === "false"

const from_attribute = (element, name) => {
    const val = element.getAttribute(name) ?? element.getAttribute(name.replaceAll("_", "-"))
    if (name === "disable_ui") {
        return truthy(val) ? true : falsey(val) ? false : null
    } else if (name === "isolated_cell_id") {
        return val == null ? null : val.split(",")
    } else {
        return val
    }
}

const preamble_html_comes_from_url_params = url_params.has("preamble_html")

/**
 *
 * @returns {import("./components/Editor.js").NotebookData}
 */
export const empty_notebook_state = ({ notebook_id }) => ({
    metadata: {},
    notebook_id: notebook_id,
    path: default_path,
    shortpath: "",
    in_temp_dir: true,
    process_status: ProcessStatus.starting,
    last_save_time: 0.0,
    last_hot_reload_time: 0.0,
    cell_inputs: {},
    cell_results: {},
    cell_dependencies: {},
    cell_order: [],
    cell_execution_order: [],
    published_objects: {},
    bonds: {},
    nbpkg: null,
    status_tree: null,
})

/**
 *
 * @param {import("./components/Editor.js").NotebookData} state
 * @returns {import("./components/Editor.js").NotebookData}
 */
const without_path_entries = (state) => ({ ...state, path: default_path, shortpath: "" })

/**
 * Fetches the statefile (usually a async resource) in launch_params.statefile
 * and makes it available for consuming by `pluto-editor`
 * To add custom logic instead, see use Environment.js
 *
 * @param {import("./components/Editor.js").LaunchParameters} launch_params
 * @param {{current: import("./components/Editor.js").EditorState}} initial_notebook_state_ref
 * @param {Function} set_ready_for_editor
 * @param {Function} set_statefile_download_progress
 */

const get_statefile =
    // @ts-ignore
    window?.pluto_injected_environment?.custom_get_statefile?.(read_Uint8Array_with_progress, without_path_entries, unpack) ??
    (async (launch_params, set_statefile_download_progress) => {
        set_statefile_download_progress("indeterminate")
        const r = await fetch(new Request(launch_params.statefile, { integrity: launch_params.statefile_integrity ?? undefined }), {
            // @ts-ignore
            priority: "high",
        })
        set_statefile_download_progress(0.2)
        const data = await read_Uint8Array_with_progress(r, (x) => set_statefile_download_progress(x * 0.8 + 0.2))
        const state = without_path_entries(unpack(data))
        return state
    })
/**
 *
 * @param {{
 *  launch_params: import("./components/Editor.js").LaunchParameters,
 *  pluto_editor_element: HTMLElement,
 * }} props
 */
const EditorLoader = ({ launch_params, pluto_editor_element }) => {
    const { statefile, statefile_integrity } = launch_params
    const static_preview = statefile != null

    const [statefile_download_progress, set_statefile_download_progress] = useState(null)

    const initial_notebook_state_ref = useRef(empty_notebook_state(launch_params))
    const [error_banner, set_error_banner] = useState(/** @type {import("./imports/Preact.js").ReactElement?} */ (null))
    const [ready_for_editor, set_ready_for_editor] = useState(!static_preview)

    useEffect(() => {
        if (!ready_for_editor && static_preview) {
            get_statefile(launch_params, set_statefile_download_progress)
                .then((state) => {
                    console.log({ state })
                    initial_notebook_state_ref.current = state
                    set_ready_for_editor(true)
                })
                .catch((e) => {
                    console.error(e)
                    set_error_banner(html`
                        <main style="font-family: system-ui, sans-serif;">
                            <h2>Failed to load notebook</h2>
                            <p>The statefile failed to download. Original error message:</p>
                            <pre style="overflow: auto;"><code>${e.toString()}</code></pre>
                            <p>Launch parameters:</p>
                            <pre style="overflow: auto;"><code>${JSON.stringify(launch_params, null, 2)}</code></pre>
                        </main>
                    `)
                })
        }
    }, [ready_for_editor, static_preview, statefile])

    useEffect(() => {
        set_disable_ui_css(launch_params.disable_ui, pluto_editor_element)
    }, [launch_params.disable_ui])

    const preamble_element = launch_params.preamble_html
        ? html`<${RawHTMLContainer} body=${launch_params.preamble_html} className=${"preamble"} sanitize_html=${preamble_html_comes_from_url_params} />`
        : null

    return error_banner != null
        ? error_banner
        : ready_for_editor
          ? html`<${Editor}
                initial_notebook_state=${initial_notebook_state_ref.current}
                launch_params=${launch_params}
                preamble_element=${preamble_element}
                pluto_editor_element=${pluto_editor_element}
            />`
          : // todo: show preamble html
            html`
                ${preamble_element}
                <${FetchProgress} progress=${statefile_download_progress} />
            `
}

// Create a web component for EditorLoader that takes in additional launch parameters as attributes
// possible attribute names are `Object.keys(launch_params)`

// This means that you can do stuff like:
/* 
<pluto-editor disable_ui notebookfile="https://juliapluto.github.io/weekly-call-notes/2022/02-10/notes.jl" statefile="https://juliapluto.github.io/weekly-call-notes/2022/02-10/notes.plutostate"  ></pluto-editor>
        
<pluto-editor disable_ui notebookfile="https://juliapluto.github.io/weekly-call-notes/2022/02-10/notes.jl" statefile="https://juliapluto.github.io/weekly-call-notes/2022/02-10/notes.plutostate"  ></pluto-editor> 
*/

// or:

/* 
<pluto-editor notebook_id="fcc1b498-a141-11ec-342a-593db1016648"></pluto-editor>

<pluto-editor notebook_id="21ebc942-a1ed-11ec-2505-7b242b18daf3"></pluto-editor>

TODO: Make this self-contained (currently depends on various stuff being on window.*, e.g. observablehq library, lodash etc)
*/

class PlutoEditorComponent extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        if (this.hasAttribute("skip-custom-element")) return

        /** Web components only support text attributes. We deserialize into js here */
        const new_launch_params = Object.fromEntries(Object.entries(launch_params).map(([k, v]) => [k, from_attribute(this, k) ?? v]))
        console.log("Launch parameters: ", new_launch_params)

        document.querySelector(".delete-me-when-live")?.remove()
        render(html`<${EditorLoader} launch_params=${new_launch_params} pluto_editor_element=${this} />`, this)
    }
}
customElements.define("pluto-editor", PlutoEditorComponent)
