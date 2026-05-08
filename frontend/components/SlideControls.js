import { t } from "../common/lang.js"
import { html, useRef, useState, useLayoutEffect, useEffect } from "../imports/Preact.js"

export const SlideControls = () => {
    const button_prev_ref = useRef(/** @type {HTMLButtonElement?} */ (null))
    const button_next_ref = useRef(/** @type {HTMLButtonElement?} */ (null))

    const [presenting, set_presenting] = useState(false)

    const move_slides_with_keyboard = (/** @type {KeyboardEvent} */ e) => {
        const activeElement = document.activeElement
        if (
            activeElement != null &&
            activeElement !== document.body &&
            activeElement !== button_prev_ref.current &&
            activeElement !== button_next_ref.current
        ) {
            // We do not move slides with arrow if we have an active element
            return
        }
        if (e.key === "ArrowLeft" || e.key === "PageUp") {
            button_prev_ref.current?.click()
        } else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
            button_next_ref.current?.click()
        } else if (e.key === "Escape") {
            set_presenting(false)
        } else {
            return
        }
        e.preventDefault()
    }

    const calculate_slide_positions = (/** @type {Event} */ e) => {
        const notebook_node = /** @type {HTMLElement?} */ (e.target)?.closest("pluto-editor")?.querySelector("pluto-notebook")
        if (!notebook_node) return []

        const height = window.innerHeight
        const headers = Array.from(notebook_node.querySelectorAll("pluto-output h1, pluto-output h2"))
        const pos = headers.map((el) => el.getBoundingClientRect())
        const edges = pos.map((rect) => rect.top + window.scrollY)

        edges.push(notebook_node.getBoundingClientRect().bottom + window.scrollY)

        const scrollPositions = headers.map((el, i) => {
            const edge_i = edges[i] ?? 0
            if (el.tagName == "H1") {
                // center vertically
                const slideHeight = (edges[i + 1] ?? 0) - edge_i - height
                return edge_i - Math.max(0, (height - slideHeight) / 2)
            } else {
                // align to top
                return edge_i - 20
            }
        })

        return scrollPositions
    }

    const go_previous_slide = (/** @type {Event} */ e) => {
        const positions = calculate_slide_positions(e)

        const pos = positions.reverse().find((y) => y < window.scrollY - 10)

        if (pos) window.scrollTo(window.scrollX, pos)
    }

    const go_next_slide = (/** @type {Event} */ e) => {
        const positions = calculate_slide_positions(e)
        const pos = positions.find((y) => y - 10 > window.scrollY)
        if (pos) window.scrollTo(window.scrollX, pos)
    }

    const presenting_ref = useRef(false)
    presenting_ref.current = presenting
    // @ts-ignore
    window.present = () => {
        set_presenting(!presenting_ref.current)
    }

    useLayoutEffect(() => {
        document.body.classList.toggle("presentation", presenting)

        if (!presenting) return // We do not add listeners if not presenting

        window.addEventListener("keydown", move_slides_with_keyboard)

        return () => {
            window.removeEventListener("keydown", move_slides_with_keyboard)
        }
    }, [presenting])

    return html`
        <nav id="slide_controls" inert=${!presenting}>
            <button ref=${button_prev_ref} class="changeslide prev" title=${t("t_presentation_previous_slide")} onClick=${go_previous_slide}>
                <span></span>
            </button>
            <button ref=${button_next_ref} class="changeslide next" title=${t("t_presentation_next_slide")} onClick=${go_next_slide}><span></span></button>
        </nav>
    `
}
