import { html, useRef, useState, useContext, useEffect, useLayoutEffect } from "../imports/Preact.js"

import { ANSITextOutput, OutputBody, PlutoImage } from "./CellOutput.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { useEventListener } from "../common/useEventListener.js"
import { is_noop_action } from "../common/SliderServerClient.js"
import { t } from "../common/lang.js"

// this is different from OutputBody because:
// it does not wrap in <div>. We want to do that in OutputBody for reasons that I forgot (feel free to try and remove it), but we dont want it here
// i think this is because i wrote those css classes with the assumption that pluto cell output is wrapped in a div, and tree viewer contents are not
// whatever
//
// We use a `<pre>${body}` instead of `<pre><code>${body}`, also for some CSS reasons that I forgot
//
// TODO: remove this, use OutputBody instead (maybe add a `wrap_in_div` option), and fix the CSS classes so that i all looks nice again
export const SimpleOutputBody = ({ mime, body, cell_id, persist_js_state, sanitize_html = true }) => {
    switch (mime) {
        case "image/png":
        case "image/jpg":
        case "image/jpeg":
        case "image/gif":
        case "image/bmp":
        case "image/svg+xml":
            return html`<${PlutoImage} mime=${mime} body=${body} />`
            break
        case "text/plain":
            // Check if the content contains ANSI escape codes
            return html`<${ANSITextOutput} body=${body} />`
        case "application/vnd.pluto.tree+object":
            return html`<${TreeView} cell_id=${cell_id} body=${body} persist_js_state=${persist_js_state} sanitize_html=${sanitize_html} />`
            break
        default:
            return OutputBody({ mime, body, cell_id, persist_js_state, sanitize_html, last_run_timestamp: null })
            break
    }
}

const More = ({ on_click_more, disable }) => {
    const [loading, set_loading] = useState(false)
    const element_ref = useRef(/** @type {HTMLElement?} */ (null))
    useKeyboardClickable(element_ref)

    return html`<pluto-tree-more
        ref=${element_ref}
        tabindex=${disable ? "-1" : "0"}
        role="button"
        aria-disabled=${disable ? "true" : "false"}
        disable=${disable}
        class=${loading ? "loading" : disable ? "disabled" : ""}
        onclick=${(e) => {
            if (!loading && !disable) {
                if (on_click_more() !== false) {
                    set_loading(true)
                }
            }
        }}
        >${t("t_tree_show_more_items")}</pluto-tree-more
    >`
}

const useKeyboardClickable = (element_ref) => {
    useEventListener(
        element_ref,
        "keydown",
        (e) => {
            if (e.key === " ") {
                e.preventDefault()
            }
            if (e.key === "Enter") {
                e.preventDefault()
                element_ref.current.click()
            }
        },
        []
    )

    useEventListener(
        element_ref,
        "keyup",
        (e) => {
            if (e.key === " ") {
                e.preventDefault()
                element_ref.current.click()
            }
        },
        []
    )
}

const prefix = ({ prefix, prefix_short }) => {
    const element_ref = useRef(/** @type {HTMLElement?} */ (null))
    useKeyboardClickable(element_ref)
    return html`<pluto-tree-prefix role="button" tabindex="0" ref=${element_ref}
        ><span class="long">${prefix}</span><span class="short">${prefix_short}</span></pluto-tree-prefix
    >`
}

const actions_show_more = ({ pluto_actions, cell_id, node_ref, objectid, dim }) => {
    const actions = pluto_actions ?? node_ref.current.closest("pluto-cell")._internal_pluto_actions
    return actions.reshow_cell(cell_id ?? node_ref.current.closest("pluto-cell").id, objectid, dim)
}

export const TreeView = ({ mime, body, cell_id, persist_js_state, sanitize_html = true }) => {
    let pluto_actions = useContext(PlutoActionsContext)
    const node_ref = useRef(/** @type {HTMLElement?} */ (null))

    const onclick = (e) => {
        // TODO: this could be reactified but no rush
        let self = node_ref.current
        if (!self) return
        let clicked = e.target.closest("pluto-tree-prefix") != null ? e.target.closest("pluto-tree-prefix").parentElement : e.target
        if (clicked !== self && !self.classList.contains("collapsed")) {
            return
        }
        const parent_tree = self.parentElement?.closest("pluto-tree")
        if (parent_tree != null && parent_tree.classList.contains("collapsed")) {
            return // and bubble upwards
        }

        self.classList.toggle("collapsed")
    }
    const on_click_more = () => {
        if (node_ref.current == null || node_ref.current.closest("pluto-tree.collapsed") != null) {
            return false
        }
        return actions_show_more({
            pluto_actions,
            cell_id,
            node_ref,
            objectid: body.objectid,
            dim: 1,
        })
    }
    const more_is_noop_action = is_noop_action(pluto_actions?.reshow_cell)

    const mimepair_output = (pair) =>
        html`<${SimpleOutputBody} cell_id=${cell_id} mime=${pair[1]} body=${pair[0]} persist_js_state=${persist_js_state} sanitize_html=${sanitize_html} />`
    const more = html`<p-r><${More} disable=${more_is_noop_action || cell_id === "cell_id_not_known"} on_click_more=${on_click_more} /></p-r>`

    let inner = null
    switch (body.type) {
        case "Pair":
            const r = body.key_value
            return html`<pluto-tree-pair class=${body.type}
                ><p-r><p-k>${mimepair_output(r[0])}</p-k><p-v>${mimepair_output(r[1])}</p-v></p-r></pluto-tree-pair
            >`
        case "circular":
            return html`<em>circular reference</em>`
        case "Array":
        case "Set":
        case "Tuple":
            inner = html`<${prefix} prefix=${body.prefix} prefix_short=${body.prefix_short} /><pluto-tree-items class=${body.type}
                    >${body.elements.map((r) =>
                        r === "more" ? more : html`<p-r>${body.type === "Set" ? "" : html`<p-k>${r[0]}</p-k>`}<p-v>${mimepair_output(r[1])}</p-v></p-r>`
                    )}</pluto-tree-items
                >`
            break
        case "Dict":
            inner = html`<${prefix} prefix=${body.prefix} prefix_short=${body.prefix_short} /><pluto-tree-items class=${body.type}
                    >${body.elements.map((r) =>
                        r === "more" ? more : html`<p-r><p-k>${mimepair_output(r[0])}</p-k><p-v>${mimepair_output(r[1])}</p-v></p-r>`
                    )}</pluto-tree-items
                >`
            break
        case "NamedTuple":
            inner = html`<${prefix} prefix=${body.prefix} prefix_short=${body.prefix_short} /><pluto-tree-items class=${body.type}
                    >${body.elements.map((r) =>
                        r === "more" ? more : html`<p-r><p-k>${r[0]}</p-k><p-v>${mimepair_output(r[1])}</p-v></p-r>`
                    )}</pluto-tree-items
                >`
            break
        case "struct":
            inner = html`<${prefix} prefix=${body.prefix} prefix_short=${body.prefix_short} /><pluto-tree-items class=${body.type}
                    >${body.elements.map((r) => html`<p-r><p-k>${r[0]}</p-k><p-v>${mimepair_output(r[1])}</p-v></p-r>`)}</pluto-tree-items
                >`
            break
    }

    return html`<pluto-tree class="collapsed ${body.type}" onclick=${onclick} ref=${node_ref}>${inner}</pluto-tree>`
}

const EmptyCols = ({ colspan = 999 }) =>
    html`<thead>
        <tr class="empty">
            <td colspan=${colspan}>
                <div>⌀ <small>${t("t_table_no_columns")}</small></div>
            </td>
        </tr>
    </thead>`

const EmptyRows = ({ colspan = 999 }) =>
    html`<tr class="empty">
        <td colspan=${colspan}>
            <div>
                <div>⌀</div>
                <small>${t("t_table_no_rows")}</small>
            </div>
        </td>
    </tr>`

export const TableView = ({ mime, body, cell_id, persist_js_state, sanitize_html }) => {
    let pluto_actions = useContext(PlutoActionsContext)
    const node_ref = useRef(null)

    const mimepair_output = (pair) =>
        html`<${SimpleOutputBody} cell_id=${cell_id} mime=${pair[1]} body=${pair[0]} persist_js_state=${persist_js_state} sanitize_html=${sanitize_html} />`
    const more = (dim) =>
        html`<${More}
            on_click_more=${() =>
                actions_show_more({
                    pluto_actions,
                    cell_id,
                    node_ref,
                    objectid: body.objectid,
                    dim,
                })}
        />`
    // More than the columns, not big enough to break Firefox (https://bugzilla.mozilla.org/show_bug.cgi?id=675417)
    const maxcolspan = 3 + (body?.schema?.names?.length ?? 1)
    const thead =
        (body?.schema?.names?.length ?? 0) === 0
            ? html`<${EmptyCols} colspan=${maxcolspan} />`
            : html`<thead>
                  <tr class="schema-names">
                      ${["", ...body.schema.names].map((x) => html`<th>${x === "more" ? more(2) : x}</th>`)}
                  </tr>
                  <tr class="schema-types">
                      ${["", ...body.schema.types].map((x) => html`<th>${x === "more" ? null : x}</th>`)}
                  </tr>
              </thead>`

    const tbody = html`<tbody>
        ${(body.rows?.length ?? 0) !== 0
            ? body.rows.map(
                  (row) =>
                      html`<tr>
                          ${row === "more"
                              ? html`<td class="pluto-tree-more-td" colspan=${maxcolspan}>${more(1)}</td>`
                              : html`<th>${row[0]}</th>
                                    ${row[1].map((x) => html`<td><div>${x === "more" ? null : mimepair_output(x)}</div></td>`)}`}
                      </tr>`
              )
            : html`<${EmptyRows} colspan=${maxcolspan} />`}
    </tbody>`

    return html`<table class="pluto-table" ref=${node_ref}>
        ${thead}${tbody}
    </table>`
}

export let DivElement = ({ cell_id, style, classname, children, persist_js_state = false, sanitize_html = true }) => {
    const mimepair_output = (pair) =>
        html`<${SimpleOutputBody} cell_id=${cell_id} mime=${pair[1]} body=${pair[0]} persist_js_state=${persist_js_state} sanitize_html=${sanitize_html} />`

    return html`<div style=${style} class=${classname}>${children.map(mimepair_output)}</div>`
}
