import { html, Component, useState, useEffect, useRef } from "../imports/Preact.js"

import { has_ctrl_or_cmd_pressed } from "../common/KeyboardShortcuts.js"

const get_element_position_in_document = (element) => {
    let top = 0
    let left = 0

    do {
        top += element.offsetTop || 0
        left += element.offsetLeft || 0
        element = element.offsetParent
    } while (element)

    return {
        top: top,
        left: left,
    }
}

const in_request_animation_frame = (fn) => {
    let last_known_arguments = null
    let ticking = false

    return (...args) => {
        last_known_arguments = args
        if (!ticking) {
            window.requestAnimationFrame(() => {
                fn(...last_known_arguments)
                ticking = false
            })

            ticking = true
        }
    }
}

/**
 *
 * @typedef Coordinate2D
 * @property {number} x
 * @property {number} y
 */

export const SelectionArea = ({ on_selection, set_scroller, cell_order }) => {
    const mouse_position_ref = useRef()
    const is_selecting_ref = useRef(false)
    const element_ref = useRef(/** @type {HTMLElement?} */ (null))

    const [selection, set_selection] = useState(/** @type {{start: Coordinate2D, end: Coordinate2D, start_screen_y: number}?} */ (null))

    useEffect(() => {
        const event_target_inside_this_notebook = (/** @type {MouseEvent} */ e) => {
            if (e.target == null) {
                return false
            }

            // this should also work for notebooks inside notebooks!
            let closest_editor = /** @type {HTMLElement} */ (e.target).closest("pluto-editor")
            let my_editor = element_ref.current?.closest("pluto-editor")

            return closest_editor === my_editor
        }

        const onmousedown = (/** @type {MouseEvent} */ e) => {
            // @ts-ignore
            const t = e.target?.tagName

            // TODO: also allow starting the selection in one codemirror and stretching it to another cell
            if (
                e.button === 0 &&
                event_target_inside_this_notebook(e) &&
                (t === "PLUTO-EDITOR" || t === "MAIN" || t === "PLUTO-NOTEBOOK" || t === "PREAMBLE")
            ) {
                on_selection([])
                set_selection({ start: { x: e.pageX, y: e.pageY }, end: { x: e.pageX, y: e.pageY }, start_screen_y: e.screenY })
                is_selecting_ref.current = true
            }
        }

        const onmouseup = (/** @type {MouseEvent} */ e) => {
            if (is_selecting_ref.current) {
                set_selection(null)
                set_scroller({ up: false, down: false })
                is_selecting_ref.current = false
            } else {
                // if you didn't click on a UI element...
                if (
                    !e.composedPath().some((e) => {
                        // @ts-ignore
                        const tag = e.tagName
                        if (e instanceof HTMLElement)
                            return e.matches("pluto-shoulder, button.input_context_menu, button.foldcode") || e.closest(".input_context_menu")
                    })
                ) {
                    // ...clear the selection
                    on_selection([])
                }
            }
        }

        let update_selection = in_request_animation_frame(({ pageX, pageY, screenY }) => {
            if (!is_selecting_ref.current || selection == null) return

            let new_selection_end = { x: pageX, y: pageY }

            const cell_nodes = Array.from(document.querySelectorAll("pluto-notebook > pluto-cell"))

            let A = {
                start_left: Math.min(selection.start.x, new_selection_end.x),
                start_top: Math.min(selection.start.y, new_selection_end.y),
                end_left: Math.max(selection.start.x, new_selection_end.x),
                end_top: Math.max(selection.start.y, new_selection_end.y),
            }
            let in_selection = cell_nodes.filter((cell) => {
                let cell_position = get_element_position_in_document(cell)
                let cell_size = cell.getBoundingClientRect()

                let B = {
                    start_left: cell_position.left,
                    start_top: cell_position.top,
                    end_left: cell_position.left + cell_size.width,
                    end_top: cell_position.top + cell_size.height,
                }
                return A.start_left < B.end_left && A.end_left > B.start_left && A.start_top < B.end_top && A.end_top > B.start_top
            })

            set_scroller({
                up: selection.start_screen_y > screenY || selection.start.y > selection.end.y,
                down: selection.start_screen_y < screenY || selection.start.y < selection.end.y,
            })

            on_selection(in_selection.map((x) => x.id))
            set_selection({ start: selection.start, end: new_selection_end, start_screen_y: selection.start_screen_y })
        })

        const onscroll = (e) => {
            if (is_selecting_ref.current) {
                update_selection({
                    pageX: mouse_position_ref.current.clientX,
                    pageY: mouse_position_ref.current.clientY + document.documentElement.scrollTop,
                    screenY: mouse_position_ref.current.screenY,
                })
            }
        }

        const onmousemove = (e) => {
            mouse_position_ref.current = e
            if (is_selecting_ref.current) {
                update_selection({ pageX: e.pageX, pageY: e.pageY, screenY: e.screenY })
                e.preventDefault()
            }
        }

        const onselectstart = (e) => {
            if (is_selecting_ref.current) {
                e.preventDefault()
            }
        }

        // Ctrl+A to select all cells
        const onkeydown = (e) => {
            if (e.key?.toLowerCase() === "a" && has_ctrl_or_cmd_pressed(e)) {
                // if you are not writing text somewhere else
                if (document.activeElement === document.body && (window.getSelection()?.isCollapsed ?? true)) {
                    on_selection(cell_order)
                    e.preventDefault()
                }
            }
        }

        document.addEventListener("mousedown", onmousedown)
        document.addEventListener("mouseup", onmouseup)
        document.addEventListener("mousemove", onmousemove)
        document.addEventListener("selectstart", onselectstart)
        document.addEventListener("keydown", onkeydown)
        document.addEventListener("scroll", onscroll, { passive: true })
        return () => {
            document.removeEventListener("mousedown", onmousedown)
            document.removeEventListener("mouseup", onmouseup)
            document.removeEventListener("mousemove", onmousemove)
            document.removeEventListener("selectstart", onselectstart)
            document.removeEventListener("keydown", onkeydown)
            // @ts-ignore
            document.removeEventListener("scroll", onscroll, { passive: true })
        }
    }, [selection])

    // let translateY = `translateY(${Math.min(selection_start.y, selection_end.y)}px)`
    // let translateX = `translateX(${Math.min(selection_start.x, selection_end.x)}px)`
    // let scaleX = `scaleX(${Math.abs(selection_start.x - selection_end.x)})`
    // let scaleY = `scaleY(${Math.abs(selection_start.y - selection_end.y)})`

    if (selection == null) {
        return html`<span ref=${element_ref}></span>`
    }
    return html`
        <pl-select-area
            ref=${element_ref}
            style=${{
                position: "absolute",
                background: "rgba(40, 78, 189, 0.24)",
                zIndex: 1000000, // Yes, really
                top: Math.min(selection.start.y, selection.end.y),
                left: Math.min(selection.start.x, selection.end.x),
                width: Math.abs(selection.start.x - selection.end.x),
                height: Math.abs(selection.start.y - selection.end.y),

                // Transform could be faster
                // top: 0,
                // left: 0,
                // width: 1,
                // height: 1,
                // transformOrigin: "top left",
                // transform: `${translateX} ${translateY} ${scaleX} ${scaleY}`,
            }}
        ></pl-select-area>
    `
}
