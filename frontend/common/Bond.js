// import Generators_input from "https://unpkg.com/@observablehq/stdlib@3.3.1/src/generators/input.js"
// import Generators_input from "https://unpkg.com/@observablehq/stdlib@3.3.1/src/generators/input.js"

import { open_pluto_popup } from "../common/open_pluto_popup.js"
import _ from "../imports/lodash-es.js"
import { html } from "../imports/Preact.js"
import { t, th } from "./lang.js"
import observablehq from "./SetupCellEnvironment.js"

/**
 * Copied from the observable stdlib source, but we need it to be faster than Generator.input because Generator.input is async by nature, so will lag behind that one tick that is breaking the code.
 * https://github.com/observablehq/stdlib/blob/170f137ac266b397446320e959c36dd21888357b/src/generators/input.js#L13
 * @param {Element} input
 * @returns {any}
 */
export function get_input_value(input) {
    if (input instanceof HTMLInputElement) {
        switch (input.type) {
            case "range":
            case "number":
                return input.valueAsNumber
            case "date":
                // "time" uses .value, which is a string. This matches observable.
                return input.valueAsDate
            case "checkbox":
                return input.checked
            case "file":
                return input.multiple ? input.files : input.files?.[0]
            default:
                return input.value
        }
    } else if (input instanceof HTMLSelectElement && input.multiple) {
        return Array.from(input.selectedOptions, (o) => o.value)
    } else {
        //@ts-ignore
        return input.value
    }
}

/**
 * Copied from the observable stdlib source (https://github.com/observablehq/stdlib/blob/170f137ac266b397446320e959c36dd21888357b/src/generators/input.js) without modifications.
 * @param {Element} input
 * @returns {string}
 */
export function eventof(input) {
    //@ts-ignore
    switch (input.type) {
        case "button":
        case "submit":
        case "checkbox":
            return "click"
        case "file":
            return "change"
        default:
            return "input"
    }
}

/**
 * Copied from the observable stdlib source (https://github.com/observablehq/stdlib/blob/170f137ac266b397446320e959c36dd21888357b/src/generators/input.js) but using our own `get_input_value` for consistency.
 * @param {Element} input
 * @returns
 */
function input_generator(input) {
    return observablehq.Generators.observe(function (change) {
        var event = eventof(input),
            value = get_input_value(input)
        function inputted() {
            change(get_input_value(input))
        }
        input.addEventListener(event, inputted)
        if (value !== undefined) change(value)
        return function () {
            input.removeEventListener(event, inputted)
        }
    })
}

/**
 * @param {Element} input
 * @param {any} new_value
 */
export const set_input_value = (input, new_value) => {
    if (input instanceof HTMLInputElement && input.type === "file") {
        return
    }
    if (new_value == null) {
        //@ts-ignore
        input.value = new_value
        return
    }
    if (input instanceof HTMLInputElement) {
        switch (input.type) {
            case "range":
            case "number": {
                if (input.valueAsNumber !== new_value) {
                    input.valueAsNumber = new_value
                }
                return
            }
            case "date": {
                if (input.valueAsDate == null || Number(input.valueAsDate) !== Number(new_value)) {
                    input.valueAsDate = new_value
                }
                return
            }
            case "checkbox": {
                if (input.checked !== new_value) {
                    input.checked = new_value
                }
                return
            }
            case "file": {
                // Can't set files :(
                return
            }
        }
    } else if (input instanceof HTMLSelectElement && input.multiple) {
        for (let option of Array.from(input.options)) {
            option.selected = new_value.includes(option.value)
        }
        return
    }
    //@ts-ignore
    if (input.value !== new_value) {
        //@ts-ignore
        input.value = new_value
    }
}

/**
 * @param {NodeListOf<Element>} bond_nodes
 * @param {import("../components/Editor.js").BondValuesDict} bond_values
 */
export const set_bound_elements_to_their_value = (bond_nodes, bond_values) => {
    bond_nodes.forEach((bond_node) => {
        let bond_name = bond_node.getAttribute("def")
        if (bond_name != null && bond_node.firstElementChild != null && bond_values[bond_name] != null) {
            let val = bond_values[bond_name].value
            try {
                set_input_value(bond_node.firstElementChild, val)
            } catch (error) {
                console.error(`Error while setting input value`, bond_node.firstElementChild, `to value`, val, `: `, error)
            }
        }
    })
}

/**
 * @param {NodeListOf<Element>} bond_nodes
 * @param {Promise<void>} invalidation
 */
export const add_bonds_disabled_message_handler = (bond_nodes, invalidation) => {
    bond_nodes.forEach((bond_node) => {
        const listener = (e) => {
            if (e.target.closest(".bonds_disabled:where(.offer_binder, .offer_local)")) {
                open_pluto_popup({
                    type: "info",
                    source_element: e.target,
                    body: th("t_bonds_static_warning", {
                        run_notebook_action: html`<a
                            href="#"
                            onClick=${(e) => {
                                //@ts-ignore
                                window.open_edit_or_run_popup()
                                e.preventDefault()
                                window.dispatchEvent(new CustomEvent("close pluto popup"))
                            }}
                            >${t("t_bonds_static_warning_inner")}</a
                        >`,
                    }),
                })
            }
        }
        bond_node.addEventListener("click", listener)
        invalidation.then(() => {
            bond_node.removeEventListener("click", listener)
        })
    })
}

/**
 * @param {NodeListOf<Element>} bond_nodes
 * @param {(name: string, value: any) => Promise} on_bond_change
 * @param {import("../components/Editor.js").BondValuesDict} known_values Object of variable names that already have a value in the state, which we may not want to send the initial bond value for. When reloading the page, bonds are set to their values from the state, and we don't want to trigger a change event for those.
 * @param {Promise<void>} invalidation
 */
export const add_bonds_listener = (bond_nodes, on_bond_change, known_values, invalidation) => {
    // the <bond> node will be invalidated when the cell re-evaluates. when this happens, we need to stop processing input events
    let node_is_invalidated = false

    invalidation.then(() => {
        node_is_invalidated = true
    })

    bond_nodes.forEach(async (bond_node) => {
        const name = bond_node.getAttribute("def")
        const bound_element_node = bond_node.firstElementChild
        if (name != null && bound_element_node != null) {
            const initial_value = get_input_value(bound_element_node)

            let skip_initialize = Object.keys(known_values).includes(name) && _.isEqual(known_values[name]?.value, initial_value)
            // Initialize the bond. This will send the data to the backend for the first time. If it's already there, and the value is the same, cells won't rerun.
            const init_promise = skip_initialize ? null : on_bond_change(name, initial_value).catch(console.error)

            // see the docs on Generators.input from observablehq/stdlib
            let skippped_first = false
            for (let val of input_generator(bound_element_node)) {
                if (node_is_invalidated) break

                if (skippped_first === false) {
                    skippped_first = true
                    continue
                }
                // wait for a new input value. If a value is ready, then this promise resolves immediately
                const to_send = await transformed_val(await val)

                // send to the Pluto back-end (have a look at set_bond in Editor.js)
                // await the setter to avoid collisions
                //TODO : get this from state
                await init_promise
                await on_bond_change(name, to_send).catch(console.error)
            }
        }
    })
}

/**
 * The identity function in most cases, loads file contents when appropriate
 * @type {((val: FileList) => Promise<Array<File>>)
 *  & ((val: File) => Promise<{ name: string, type: string, data: Uint8Array }>)
 *  & ((val: any) => Promise<any>)
 * }
 */
const transformed_val = async (val) => {
    if (val instanceof FileList) {
        return Promise.all(Array.from(val).map((file) => transformed_val(file)))
    } else if (val instanceof File) {
        return await new Promise((res) => {
            const reader = new FileReader()
            // @ts-ignore
            reader.onload = () => res({ name: val.name, type: val.type, data: new Uint8Array(reader.result) })
            reader.onerror = () => res({ name: val.name, type: val.type, data: null })
            reader.readAsArrayBuffer(val)
        })
    } else {
        return val
    }
}
