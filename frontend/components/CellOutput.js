import { html, Component, useRef, useLayoutEffect, useContext } from "../imports/Preact.js"

import DOMPurify from "../imports/DOMPurify.js"
import { ansi_to_html } from "../imports/AnsiUp.js"

import { ErrorMessage, ParseError } from "./ErrorMessage.js"
import { TreeView, TableView, DivElement } from "./TreeView.js"

import {
    add_bonds_disabled_message_handler,
    add_bonds_listener,
    set_bound_elements_to_their_value,
    get_input_value,
    set_input_value,
    eventof,
} from "../common/Bond.js"
import { cl } from "../common/ClassTable.js"

import { observablehq_for_cells } from "../common/SetupCellEnvironment.js"
import { PlutoBondsContext, PlutoActionsContext, PlutoJSInitializingContext } from "../common/PlutoContext.js"
import register from "../imports/PreactCustomElement.js"

import { EditorState, EditorView, defaultHighlightStyle, syntaxHighlighting } from "../imports/CodemirrorPlutoSetup.js"

import { pluto_syntax_colors_julia, ENABLE_CM_MIXED_PARSER } from "./CellInput.js"

import hljs from "../imports/highlightjs.js"
import { julia_mixed } from "./CellInput/mixedParsers.js"
import { julia } from "../imports/CodemirrorPlutoSetup.js"
import { SafePreviewSanitizeMessage } from "./SafePreviewUI.js"
import lodashLibrary from "../imports/lodash.js"
import { t } from "../common/lang.js"

const prettyAssignee = (assignee) =>
    assignee && assignee.startsWith("const ") ? html`<span style="color: var(--cm-color-keyword)">const</span> ${assignee.slice(6)}` : assignee

export class CellOutput extends Component {
    constructor() {
        super()
        this.state = {
            output_changed_once: false,
        }

        this.old_height = 0
        // @ts-ignore Is there a way to use the latest DOM spec?
        this.resize_observer = new ResizeObserver((entries) => {
            const new_height = this.base?.offsetHeight ?? 0

            if (new_height !== this.old_height) {
                // Scroll the page to compensate for change in page height:
                if (document.body.querySelector("pluto-cell:focus-within")) {
                    const cell_outputs_after_focused = document.body.querySelectorAll("pluto-cell:focus-within ~ pluto-cell > pluto-output") // CSS wizardry ✨
                    if (
                        !(document.activeElement?.tagName === "SUMMARY") &&
                        (cell_outputs_after_focused.length === 0 || !Array.from(cell_outputs_after_focused).includes(this.base))
                    ) {
                        window.scrollBy(0, new_height - this.old_height)
                    }
                }
            }

            this.old_height = new_height
        })
    }

    shouldComponentUpdate({ last_run_timestamp, sanitize_html }) {
        return last_run_timestamp !== this.props.last_run_timestamp || sanitize_html !== this.props.sanitize_html
    }

    componentDidUpdate(old_props) {
        if (this.props.last_run_timestamp !== old_props.last_run_timestamp) {
            this.setState({ output_changed_once: true })
        }
    }

    componentDidMount() {
        this.resize_observer.observe(this.base)
    }

    componentWillUnmount() {
        this.resize_observer.unobserve(this.base)
    }

    render() {
        const rich_output =
            this.props.errored ||
            !this.props.body ||
            (this.props.mime !== "application/vnd.pluto.tree+object" &&
                this.props.mime !== "application/vnd.pluto.table+object" &&
                this.props.mime !== "text/plain")
        const allow_translate = !this.props.errored && rich_output
        return html`
            <pluto-output
                class=${cl({
                    rich_output,
                    scroll_y: this.props.mime === "application/vnd.pluto.table+object" || this.props.mime === "text/plain",
                })}
                translate=${allow_translate}
                mime=${this.props.mime}
                aria-live=${this.state.output_changed_once ? "polite" : "off"}
                aria-atomic="true"
                aria-relevant="all"
                aria-label=${this.props.rootassignee == null ? "Result of unlabeled cell:" : `Result of variable ${this.props.rootassignee}:`}
            >
                <assignee aria-hidden="true" translate=${false}>${prettyAssignee(this.props.rootassignee)}</assignee>
                <${OutputBody} ...${this.props} />
            </pluto-output>
        `
    }
}

export let PlutoImage = ({ body, mime }) => {
    // I know I know, this looks stupid.
    // BUT it is necessary to make sure the object url is only created when we are actually attaching to the DOM,
    // and is removed when we are detatching from the DOM
    let imgref = useRef()
    useLayoutEffect(() => {
        let url = URL.createObjectURL(new Blob([body], { type: mime }))

        imgref.current.onload = imgref.current.onerror = () => {
            if (imgref.current) {
                imgref.current.style.display = null
            }
        }
        if (imgref.current.src === "") {
            // an <img> that is loading takes up 21 vertical pixels, which causes a 1-frame scroll flicker
            // the solution is to make the <img> invisible until the image is loaded
            imgref.current.style.display = "none"
        }
        imgref.current.type = mime
        imgref.current.src = url

        return () => URL.revokeObjectURL(url)
    }, [body, mime])

    return html`<img ref=${imgref} type=${mime} src=${""} />`
}

/**
 * @param {{
 *  mime: string,
 * body: any,
 * cell_id: string,
 * persist_js_state: boolean | string,
 * last_run_timestamp: number?,
 * sanitize_html?: boolean | string,
 * }} args
 */
export const OutputBody = ({ mime, body, cell_id, persist_js_state = false, last_run_timestamp, sanitize_html = true }) => {
    // These two arguments might have been passed as strings if OutputBody was used as the custom HTML element <pluto-display>, with string attributes as arguments.
    sanitize_html = sanitize_html !== "false" && sanitize_html !== false
    persist_js_state = persist_js_state === "true" || persist_js_state === true

    switch (mime) {
        case "image/png":
        case "image/jpg":
        case "image/jpeg":
        case "image/gif":
        case "image/bmp":
        case "image/svg+xml":
            return html`<div><${PlutoImage} mime=${mime} body=${body} /></div>`
            break
        case "text/html":
            // Snippets starting with <!DOCTYPE or <html are considered "full pages" that get their own iframe.
            // Not entirely sure if this works the best, or if this slows down notebooks with many plots.
            // AFAIK JSServe and Plotly both trigger this code.
            // NOTE: Jupyter doesn't do this, jupyter renders everything directly in pages DOM.
            //                                                                   -DRAL
            if (body.startsWith("<!DOCTYPE") || body.startsWith("<html")) {
                return sanitize_html ? null : html`<${IframeContainer} body=${body} />`
            } else {
                return html`<${RawHTMLContainer}
                    cell_id=${cell_id}
                    body=${body}
                    persist_js_state=${persist_js_state}
                    last_run_timestamp=${last_run_timestamp}
                    sanitize_html=${sanitize_html}
                />`
            }
            break
        case "application/vnd.pluto.tree+object":
            return html`<div>
                <${TreeView} cell_id=${cell_id} body=${body} persist_js_state=${persist_js_state} sanitize_html=${sanitize_html} />
            </div>`
            break
        case "application/vnd.pluto.table+object":
            return html`<${TableView} cell_id=${cell_id} body=${body} persist_js_state=${persist_js_state} sanitize_html=${sanitize_html} />`
            break
        case "application/vnd.pluto.parseerror+object":
            return html`<div><${ParseError} cell_id=${cell_id} last_run_timestamp=${last_run_timestamp} ...${body} /></div>`
            break
        case "application/vnd.pluto.stacktrace+object":
            return html`<div><${ErrorMessage} cell_id=${cell_id} ...${body} /></div>`
            break
        case "application/vnd.pluto.divelement+object":
            return DivElement({ cell_id, ...body, persist_js_state, sanitize_html })
            break
        case "text/plain":
            if (body) {
                return html`<div><${ANSITextOutput} body=${body} /></div>`
            } else {
                return html`<div></div>`
            }
            break
        case null:
        case undefined:
        case "":
            return html``
            break
        default:
            return html`<pre title="Something went wrong displaying this object">🛑</pre>`
            break
    }
}

register(OutputBody, "pluto-display", ["mime", "body", "cell_id", "persist_js_state", "last_run_timestamp", "sanitize_html"])

let IframeContainer = ({ body }) => {
    let iframeref = useRef()
    useLayoutEffect(() => {
        let url = URL.createObjectURL(new Blob([body], { type: "text/html" }))
        iframeref.current.src = url

        run(async () => {
            await new Promise((resolve) => iframeref.current.addEventListener("load", () => resolve(null)))

            /** @type {Document} */
            let iframeDocument = iframeref.current.contentWindow.document
            /** Grab the <script> tag for the iframe content window resizer */
            let original_script_element = /** @type {HTMLScriptElement} */ (document.querySelector("#iframe-resizer-content-window-script"))

            // Insert iframe resizer inside the iframe
            let iframe_resizer_content_script = iframeDocument.createElement("script")
            iframe_resizer_content_script.src = original_script_element.src
            iframe_resizer_content_script.crossOrigin = "anonymous"
            iframeDocument.head.appendChild(iframe_resizer_content_script)

            // Apply iframe resizer from the host side
            new Promise((resolve) => iframe_resizer_content_script.addEventListener("load", () => resolve(null)))
            // @ts-ignore
            window.iFrameResize({ checkOrigin: false }, iframeref.current)
        })

        return () => URL.revokeObjectURL(url)
    }, [body])

    return html`<iframe
        style=${{ width: "100%", border: "none" }}
        src=""
        ref=${iframeref}
        frameborder="0"
        allow="accelerometer; ambient-light-sensor; autoplay; battery; camera; display-capture; document-domain; encrypted-media; execution-while-not-rendered; execution-while-out-of-viewport; fullscreen; geolocation; gyroscope; layout-animations; legacy-image-formats; magnetometer; microphone; midi; navigation-override; oversized-images; payment; picture-in-picture; publickey-credentials-get; sync-xhr; usb; wake-lock; screen-wake-lock; vr; web-share; xr-spatial-tracking"
        allowfullscreen
    ></iframe>`
}

/**
 * Call a block of code with with environment inserted as local bindings (even this)
 *
 * @param {{ code: string, environment: { [name: string]: any } }} options
 */
let execute_dynamic_function = async ({ environment, code }) => {
    // single line so that we don't affect line numbers in the stack trace
    const wrapped_code = `"use strict"; return (async () => {${code}})()`

    let { ["this"]: this_value, ...args } = environment
    let arg_names = Object.keys(args)
    let arg_values = Object.values(args)
    const result = await Function(...arg_names, wrapped_code).bind(this_value)(...arg_values)
    return result
}

/**
 * It is possible for `execute_scripttags` to run during the execution of `execute_scripttags`, and this variable counts the depth of this nesting.
 *
 * One case where nesting occurs is when using PlutoRunner.embed_display. In its HTML render, it outputs a `<script>`, which will render a `<pluto-display>` element with content. If that content contains a `<script>` tag, then it will be executed during the execution of the original script, etc.
 *
 * See https://github.com/fonsp/Pluto.jl/pull/2329
 */
let nested_script_execution_level = 0

/**
 * Runs the code `fn` with `document.currentScript` being set to a new script_element thats
 * is placed on the page where `script_element` was.
 *
 * Why? So we can run the javascript code with extra cool Pluto variables and return value,
 * but still have a script at the same position as `document.currentScript`.
 * This way you can do `document.currentScript.insertBefore()` and have it work!
 *
 * This will remove the passed in `script_element` from the DOM!
 *
 * @param {HTMLOrSVGScriptElement} script_element
 * @param {() => any} fn
 */
let execute_inside_script_tag_that_replaces = async (script_element, fn) => {
    // Mimick as much as possible from the original script (only attributes but sure)
    let new_script_tag = document.createElement("script")
    for (let attr of script_element.attributes) {
        //@ts-ignore because of https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1260
        new_script_tag.attributes.setNamedItem(attr.cloneNode(true))
    }
    const container_name = `____FUNCTION_TO_RUN_INSIDE_SCRIPT_${nested_script_execution_level}`
    new_script_tag.textContent = `{
        window.${container_name}.result = window.${container_name}.function_to_run(window.${container_name}.currentScript)
    }`

    // @ts-ignore
    // I use this long variable name to pass the function and result to and from the script we created
    window[container_name] = { function_to_run: fn, currentScript: new_script_tag, result: null }
    // Put the script in the DOM, this will run the script
    const parent = script_element.parentNode
    if (parent == null) {
        throw "Failed to execute script it has no parent in DOM."
    }
    parent.replaceChild(new_script_tag, script_element)
    // @ts-ignore - Get the result back
    let result = await window[container_name].result
    // @ts-ignore - Reset the global variable "just in case"
    window[container_name] = { function_to_run: fn, result: null }

    return { node: new_script_tag, result: result }
}

const is_displayable = (result) => result instanceof Element && result.nodeType === Node.ELEMENT_NODE

/**
 * @typedef {HTMLScriptElement} PlutoScript
 * @property {boolean?} pluto_is_loading_me
 */

/**
 *
 * @param {{
 * root_node: HTMLElement,
 * script_nodes: Array<PlutoScript>,
 * previous_results_map: Map,
 * invalidation: Promise<void>,
 * pluto_actions: any,
 * }} param0
 * @returns
 */
const execute_scripttags = async ({ root_node, script_nodes, previous_results_map, invalidation, pluto_actions }) => {
    let results_map = new Map()

    // Reattach DOM results from old scripts, you might want to skip reading this
    for (let node of script_nodes) {
        if (node.src != null && node.src !== "") {
        } else {
            let script_id = node.id
            let old_result = script_id ? previous_results_map.get(script_id) : null
            if (is_displayable(old_result)) {
                node.parentElement?.insertBefore(old_result, node)
            }
        }
    }

    // Run scripts sequentially
    for (let node of script_nodes) {
        nested_script_execution_level += 1
        if (node.src != null && node.src !== "") {
            // If it has a remote src="", de-dupe and copy the script to head
            let script_el = Array.from(document.head.querySelectorAll("script")).find((s) => s.src === node.src)

            if (script_el == undefined) {
                script_el = document.createElement("script")
                script_el.referrerPolicy = node.referrerPolicy
                script_el.crossOrigin = node.crossOrigin
                script_el.integrity = node.integrity
                script_el.noModule = node.noModule
                script_el.nonce = node.nonce
                script_el.type = node.type
                script_el.src = node.src
                // Not copying defer or async because this script is not included in the initial HTML document, so it has no effect.
                // @ts-ignore
                script_el.pluto_is_loading_me = true
            }
            let script_el_really = script_el // for typescript

            // @ts-ignore
            const need_to_await = script_el_really.pluto_is_loading_me != null
            if (need_to_await) {
                await new Promise((resolve) => {
                    script_el_really.addEventListener("load", resolve)
                    script_el_really.addEventListener("error", resolve)
                    document.head.appendChild(script_el_really)
                })
                // @ts-ignore
                script_el_really.pluto_is_loading_me = undefined
            }
        } else {
            // If there is no src="", we take the content and run it in an observablehq-like environment
            try {
                let code = node.textContent
                let script_id = node.id
                let old_result = script_id ? previous_results_map.get(script_id) : null

                if (node.type === "module") {
                    console.warn("We don't (yet) fully support <script type=module> (loading modules with <script type=module src=...> is fine).")
                }

                if (node.type === "" || node.type === "text/javascript" || node.type === "module") {
                    if (is_displayable(old_result)) {
                        node.parentElement?.insertBefore(old_result, node)
                    }

                    const cell = root_node.closest("pluto-cell")
                    let { node: new_node, result } = await execute_inside_script_tag_that_replaces(node, async (currentScript) => {
                        return await execute_dynamic_function({
                            environment: {
                                this: script_id ? old_result : window,
                                currentScript: currentScript,
                                invalidation: invalidation,
                                // @ts-ignore
                                getPublishedObject: (id) => cell.getPublishedObject(id),

                                _internal_getJSLinkResponse: (cell_id, link_id) => (input) =>
                                    pluto_actions.request_js_link_response(cell_id, link_id, input).then(([success, result]) => {
                                        if (success) return result
                                        throw result
                                    }),
                                getBoundElementValueLikePluto: get_input_value,
                                setBoundElementValueLikePluto: set_input_value,
                                getBoundElementEventNameLikePluto: eventof,

                                getNotebookMetadataExperimental: (key) => pluto_actions.get_notebook()?.metadata?.[key],
                                setNotebookMetadataExperimental: (key, value) =>
                                    pluto_actions.update_notebook((notebook) => {
                                        notebook.metadata[key] = value
                                    }),
                                deleteNotebookMetadataExperimental: (key) =>
                                    pluto_actions.update_notebook((notebook) => {
                                        delete notebook.metadata[key]
                                    }),

                                ...(cell == null
                                    ? {}
                                    : {
                                          getCellMetadataExperimental: (key, { cell_id = null } = {}) =>
                                              pluto_actions.get_notebook()?.cell_inputs?.[cell_id ?? cell.id]?.metadata?.[key],
                                          setCellMetadataExperimental: (key, value, { cell_id = null } = {}) =>
                                              pluto_actions.update_notebook((notebook) => {
                                                  notebook.cell_inputs[cell_id ?? cell.id].metadata[key] = value
                                              }),
                                          deleteCellMetadataExperimental: (key, { cell_id = null } = {}) =>
                                              pluto_actions.update_notebook((notebook) => {
                                                  delete notebook.cell_inputs[cell_id ?? cell.id].metadata[key]
                                              }),
                                      }),

                                ...observablehq_for_cells,
                                _: lodashLibrary,
                            },
                            code,
                        })
                    })

                    // Save result for next run
                    if (script_id != null) {
                        results_map.set(script_id, result)
                    }
                    // Insert returned element
                    if (result !== old_result) {
                        if (is_displayable(old_result)) {
                            old_result.remove()
                        }
                        if (is_displayable(result)) {
                            new_node.parentElement?.insertBefore(result, new_node)
                        }
                    }
                }
            } catch (err) {
                console.error("Couldn't execute script:", node)
                // needs to be in its own console.error so that the stack trace is printed
                console.error(err)
                // TODO: relay to user
            }
        }
        nested_script_execution_level -= 1
    }
    return results_map
}

let run = (f) => f()

/**
 * Support declarative shadowroot 😺
 * https://web.dev/declarative-shadow-dom/
 * The polyfill they mention on the page is nice and all, but we need more.
 * For one, we need the polyfill anyway as we're adding html using innerHTML (just like we need to run the scripts ourselves)
 * Also, we want to run the scripts inside the shadow roots, ideally in the same order that a browser would.
 * And we want nested shadowroots, which their polyfill doesn't provide (and I hope the spec does)
 *
 * @param {HTMLTemplateElement} template
 */
let declarative_shadow_dom_polyfill = (template) => {
    try {
        const mode = template.getAttribute("shadowroot")
        // @ts-ignore
        const shadowRoot = template.parentElement.attachShadow({ mode })
        // @ts-ignore
        shadowRoot.appendChild(template.content)
        template.remove()

        // To mimick as much as possible the browser behavior, I
        const scripts_or_shadowroots = Array.from(shadowRoot.querySelectorAll("script, template[shadowroot]"))
        return scripts_or_shadowroots.flatMap((script_or_shadowroot) => {
            if (script_or_shadowroot.nodeName === "SCRIPT") {
                return [script_or_shadowroot]
            } else if (script_or_shadowroot.nodeName === "TEMPLATE") {
                // @ts-ignore
                return declarative_shadow_dom_polyfill(script_or_shadowroot)
            }
        })
    } catch (error) {
        console.error(`Couldn't attach declarative shadow dom to`, template, `because of`, error)
        return []
    }
}

export let RawHTMLContainer = ({ body, className = "", persist_js_state = false, last_run_timestamp, sanitize_html = true, sanitize_html_message = true }) => {
    let pluto_actions = useContext(PlutoActionsContext)
    let pluto_bonds = useContext(PlutoBondsContext)
    let js_init_set = useContext(PlutoJSInitializingContext)
    let previous_results_map = useRef(new Map())

    let invalidate_scripts = useRef(() => {})

    let container_ref = useRef(/** @type {HTMLElement?} */ (null))

    useLayoutEffect(() => {
        if (container_ref.current && pluto_bonds) set_bound_elements_to_their_value(container_ref.current.querySelectorAll("bond"), pluto_bonds)
    }, [body, persist_js_state, pluto_actions, pluto_bonds, sanitize_html])

    useLayoutEffect(() => {
        const container = container_ref.current
        if (container == null) return

        // Invalidate current scripts and create a new invalidation token immediately
        let invalidation = new Promise((resolve) => {
            invalidate_scripts.current = () => {
                resolve(null)
            }
        })

        const dump = document.createElement("p-dumpster")
        // @ts-ignore
        dump.append(...container.childNodes)

        let html_content_to_set = sanitize_html
            ? DOMPurify.sanitize(body, {
                  FORBID_TAGS: ["style"],
                  ADD_ATTR: ["target"],
              })
            : body

        // Actually "load" the html
        container.innerHTML = html_content_to_set

        if (sanitize_html_message && html_content_to_set !== body) {
            // DOMPurify also resolves HTML entities, which can give a false positive. To fix this, we use DOMParser to parse both strings, and we compare the innerHTML of the resulting documents.
            const parser = new DOMParser()
            const p1 = parser.parseFromString(body, "text/html")
            const p2 = parser.parseFromString(html_content_to_set, "text/html")

            if (p2.documentElement.innerHTML !== p1.documentElement.innerHTML) {
                console.info("HTML sanitized", { body, html_content_to_set })
                let info_element = document.createElement("div")
                info_element.innerHTML = SafePreviewSanitizeMessage
                container.prepend(info_element)
            }
        }

        if (sanitize_html) return

        let scripts_in_shadowroots = Array.from(container.querySelectorAll("template[shadowroot]")).flatMap((template) => {
            // @ts-ignore
            return declarative_shadow_dom_polyfill(template)
        })

        // do this synchronously after loading HTML
        const new_scripts = [...scripts_in_shadowroots, ...Array.from(container.querySelectorAll("script"))]

        run(async () => {
            try {
                js_init_set?.add(container)
                previous_results_map.current = await execute_scripttags({
                    root_node: container,
                    script_nodes: new_scripts,
                    invalidation,
                    previous_results_map: persist_js_state ? previous_results_map.current : new Map(),
                    pluto_actions,
                })

                if (pluto_actions != null) {
                    const on_bond_value = (name, value) => pluto_actions?.set_bond?.(name, value) ?? Promise.resolve()

                    const bond_nodes = container.querySelectorAll("bond")
                    set_bound_elements_to_their_value(bond_nodes, pluto_bonds ?? {})
                    add_bonds_listener(bond_nodes, on_bond_value, pluto_bonds ?? {}, invalidation)
                    add_bonds_disabled_message_handler(bond_nodes, invalidation)
                }

                apply_enhanced_markup_features(container, pluto_actions)
            } finally {
                js_init_set?.delete(container)
            }
        })

        return () => {
            js_init_set?.delete(container)
            invalidate_scripts.current?.()
        }
    }, [body, last_run_timestamp, pluto_actions, sanitize_html])

    return html`<div dir="auto" class="raw-html-wrapper ${className}" ref=${container_ref}></div>`
}

// https://github.com/fonsp/Pluto.jl/issues/1692
const ENABLE_CM_HIGHLIGHTING = false

/** @param {HTMLElement} code_element */
export let highlight = (code_element, language) => {
    language = language.toLowerCase()
    language = language === "jl" ? "julia" : language

    if (code_element.children.length === 0) {
        if (
            ENABLE_CM_HIGHLIGHTING &&
            language === "julia" &&
            // CodeMirror does not want to render inside a `<details>`...
            // I tried to debug this, it does not happen on a clean webpage with the same CM versions:
            // https://glitch.com/edit/#!/wobbly-sweet-fibre?path=script.js%3A51%3A76
            code_element.closest("details") == null
        ) {
            const editorview = new EditorView({
                state: EditorState.create({
                    // Remove references to `Main.workspace#xx.` in the docs since
                    // its shows up as a comment and can be confusing
                    doc: code_element.innerText
                        .trim()
                        .replace(/Main.var\"workspace#\d+\"\./, "")
                        .replace(/Main.workspace#\d+\./, "")
                        .replace(/Main.workspace#(\d+)/, 'Main.var"workspace#$1"'),

                    extensions: [
                        syntaxHighlighting(pluto_syntax_colors_julia),
                        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                        EditorState.tabSize.of(4),
                        // TODO Other languages possibly?
                        ...(language === "julia" ? [ENABLE_CM_MIXED_PARSER ? julia_mixed() : julia()] : []),
                        EditorView.lineWrapping,
                        EditorView.editable.of(false),
                    ].filter((x) => x != null),
                }),
            })
            code_element.replaceChildren(editorview.dom)
            // Weird hack to make it work inline 🤷‍♀️
            // Probably should be using [HighlightTree](https://codemirror.net/6/docs/ref/#highlight.highlightTree)
            editorview.dom.style.setProperty("display", "inline-flex", "important")
            editorview.dom.style.setProperty("background-color", "transparent", "important")
        } else {
            if (language === "htmlmixed") {
                code_element.classList.remove("language-htmlmixed")
                code_element.classList.add("language-html")
            }
            hljs.highlightElement(code_element)
        }
    }
}

/**
 * Generates a copy button for Markdown code blocks.
 */
export const generateCopyCodeButton = (/** @type {HTMLElement?} */ pre) => {
    if (!pre) return

    // create copy button
    const button = document.createElement("button")
    button.title = t("t_copy_action_description")
    button.className = "markdown-code-block-button"
    button.addEventListener("click", (e) => {
        const txt = pre.textContent ?? ""
        navigator.clipboard.writeText(txt)

        button.classList.add("recently-copied")
        setTimeout(() => {
            button.classList.remove("recently-copied")
        }, 1300)
    })

    // Append copy button to the code block element
    pre.prepend(button)
}

/**
 * Generates a copy button for Markdown header elements, to copy the URL to this header using the `id`.
 */
export const generateCopyHeaderIdButton = (/** @type {HTMLHeadingElement} */ header, /** @type {any} */ pluto_actions) => {
    const id = header.id
    if (!id) return
    const button = document.createElement("pluto-header-id-copy")
    button.title = t("t_copy_header_id_action_description")
    button.ariaLabel = t("t_copy_header_id_action_description")
    button.role = "button"
    button.tabIndex = 0
    const listener = (_e) => {
        const id = header.id
        if (!id) return
        let url_to_copy = `#${id}`
        const launch_params = /** @type {import("./Editor.js").LaunchParameters?} */ (pluto_actions?.get_launch_params?.())
        if (launch_params?.isolated_cell_ids != null) return
        const root = new URL(window.location.href)
        root.hash = ""

        const is_localhost_hostname = (hostname) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0"
        if (
            (!launch_params || (launch_params.disable_ui && launch_params.notebook_id == null && launch_params.pluto_server_url == null)) &&
            !is_localhost_hostname(root.hostname)
        ) {
            url_to_copy = `${root.href}${url_to_copy}`
        }

        navigator.clipboard.writeText(url_to_copy)

        button.classList.add("recently-copied")
        setTimeout(() => {
            button.classList.remove("recently-copied")
        }, 1300)
    }
    button.addEventListener("click", listener)
    button.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        listener(e)
        e.preventDefault()
    })

    const wrapper = document.createElement("pluto-header-id-copy-wrapper")
    wrapper.append(button)
    header.append(wrapper)
}

export const ANSITextOutput = ({ body }) => {
    const has_ansi = /\x1b\[\d+m/.test(body)

    if (has_ansi) {
        return html`<${ANSIUpContents} body=${body} />`
    } else {
        return html`<pre class="no-block"><code>${body}</code></pre>`
    }
}

const ANSIUpContents = ({ body }) => {
    const node_ref = useRef(/** @type {HTMLElement?} */ (null))
    useLayoutEffect(() => {
        if (!node_ref.current) return
        node_ref.current.innerHTML = ansi_to_html(body)
    }, [body])
    return html`<pre class="no-block"><code ref=${node_ref}></code></pre>`
}

function apply_enhanced_markup_features(container, pluto_actions) {
    // Convert LaTeX to svg
    // @ts-ignore
    if (window.MathJax?.typeset != undefined) {
        try {
            // @ts-ignore
            window.MathJax.typeset(container.querySelectorAll(".tex"))
        } catch (err) {
            console.info("Failed to typeset TeX:")
            console.info(err)
        }
    }

    // Apply syntax highlighting
    try {
        container.querySelectorAll("code").forEach((code_element) => {
            code_element.classList.forEach((className) => {
                if (className.startsWith("language-") && !className.endsWith("undefined")) {
                    // Remove "language-"
                    let language = className.substring(9)
                    highlight(code_element, language)
                }
            })
        })
    } catch (err) {
        console.warn("Highlighting failed", err)
    }

    // Find code blocks and add a copy button:
    try {
        if (container.firstElementChild?.matches("div.markdown")) {
            container.querySelectorAll("pre > code").forEach((code_element) => {
                const pre = code_element.parentElement
                if (pre.closest("table, pluto-display, bond, pluto-tree")) return
                generateCopyCodeButton(pre)
            })
            container.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((header_element) => {
                if (header_element.closest("table, pluto-display, bond, pluto-tree")) return
                generateCopyHeaderIdButton(/** @type {HTMLHeadingElement} */ (header_element), pluto_actions)
            })
        }
    } catch (err) {
        console.warn("Adding markdown code copy button failed", err)
    }
}

// Exposing this for PlutoPages.jl
// @ts-ignore
window.__pluto_apply_enhanced_markup_features = apply_enhanced_markup_features
