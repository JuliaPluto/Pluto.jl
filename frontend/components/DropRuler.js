import { html, Component } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

/**
 * @typedef DropRulerProps
 * @type {{
 *   actions: any,
 *   selected_cells: string[],
 *   set_scroller: (enabled: any) => void
 *   serialize_selected: (id: string) => string | undefined,
 *   pluto_editor_element: HTMLElement,
 * }}
 */

/**
 * @augments Component<DropRulerProps,any>
 */
export class DropRuler extends Component {
    constructor(/** @type {DropRulerProps} */ props) {
        super(props)
        this.dropee = null
        this.dropped = null
        this.cell_edges = []
        this.pointer_position = { pageX: 0, pageY: 0 }
        this.precompute_cell_edges = () => {
            /** @type {Array<HTMLElement>} */
            const cell_nodes = Array.from(this.props.pluto_editor_element.querySelectorAll(":scope > main > pluto-notebook > pluto-cell"))
            this.cell_edges = cell_nodes.map((el) => el.offsetTop)
            this.cell_edges.push(last(cell_nodes).offsetTop + last(cell_nodes).scrollHeight)
        }
        this.getDropIndexOf = ({ pageX, pageY }) => {
            const editorY =
                pageY -
                ((this.props.pluto_editor_element.querySelector("main") ?? this.props.pluto_editor_element).getBoundingClientRect().top +
                    document.documentElement.scrollTop)

            const distances = this.cell_edges.map((p) => Math.abs(p - editorY - 8)) // 8 is the magic computer number: https://en.wikipedia.org/wiki/8
            return argmin(distances)
        }

        this.state = {
            drag_start: false,
            drag_target: false,
            drop_index: 0,
        }
    }

    componentDidMount() {
        const event_not_for_me = (/** @type {MouseEvent} */ e) => {
            return (e.target instanceof Element ? e.target.closest("pluto-editor") : null) !== this.props.pluto_editor_element
        }

        document.addEventListener("dragstart", (e) => {
            if (event_not_for_me(e)) return
            if (!e.dataTransfer) return
            let target = /** @type {Element} */ (e.target)
            let pe = target.parentElement
            if (target.matches("pluto-shoulder") && pe != null) {
                this.dropee = pe
                let data = this.props.serialize_selected(pe.id)
                if (data) e.dataTransfer.setData("text/pluto-cell", data)
                this.dropped = false
                this.precompute_cell_edges()

                this.setState({
                    drag_start: true,
                    drop_index: this.getDropIndexOf(e),
                })
                this.props.set_scroller({ up: true, down: true })
            } else {
                this.setState({
                    drag_start: false,
                    drag_target: false,
                })
                this.props.set_scroller({ up: false, down: false })
                this.dropee = null
            }
        })
        document.addEventListener("dragenter", (e) => {
            if (event_not_for_me(e)) return
            if (!e.dataTransfer) return
            if (e.dataTransfer.types[0] !== "text/pluto-cell") return
            if (!this.state.drag_target) this.precompute_cell_edges()
            this.lastenter = e.target
            this.setState({ drag_target: true })
            e.preventDefault()
        })
        document.addEventListener("dragleave", (e) => {
            if (event_not_for_me(e)) return
            if (!e.dataTransfer) return
            if (e.dataTransfer.types[0] !== "text/pluto-cell") return
            if (e.target === this.lastenter) {
                this.setState({ drag_target: false })
            }
        })
        const precompute_cell_edges_throttled = _.throttle(this.precompute_cell_edges, 4000, { leading: false, trailing: true })
        const update_drop_index_throttled = _.throttle(
            () => {
                this.setState({
                    drop_index: this.getDropIndexOf(this.pointer_position),
                })
            },
            100,
            { leading: false, trailing: true }
        )
        document.addEventListener("dragover", (e) => {
            if (event_not_for_me(e)) return
            if (!e.dataTransfer) return
            // Called continuously during drag
            if (e.dataTransfer.types[0] !== "text/pluto-cell") return
            this.pointer_position = e

            precompute_cell_edges_throttled()
            update_drop_index_throttled()

            if (this.state.drag_start) {
                // Then we're dragging a cell from within the notebook. Use a move icon:
                e.dataTransfer.dropEffect = "move"
            }
            e.preventDefault()
        })
        document.addEventListener("dragend", (e) => {
            if (event_not_for_me(e)) return
            // Called after drag, also when dropped outside of the browser or when ESC is pressed
            update_drop_index_throttled.flush()
            this.setState({
                drag_start: false,
                drag_target: false,
            })
            this.props.set_scroller({ up: false, down: false })
        })
        document.addEventListener("drop", (e) => {
            if (event_not_for_me(e)) return
            if (!e.dataTransfer) return
            // Guaranteed to fire before the 'dragend' event
            // Ignore files
            if (e.dataTransfer.types[0] !== "text/pluto-cell") {
                return
            }
            this.setState({
                drag_target: false,
            })
            this.dropped = true
            if (this.dropee && this.state.drag_start) {
                // Called when drag-dropped somewhere on the page
                const drop_index = this.getDropIndexOf(e)
                const friend_ids = this.props.selected_cells.includes(this.dropee.id) ? this.props.selected_cells : [this.dropee.id]
                this.props.actions.move_remote_cells(friend_ids, drop_index)
            } else {
                // Called when cell(s) from another window are dragged onto the page
                const drop_index = this.getDropIndexOf(e)
                const data = e.dataTransfer.getData("text/pluto-cell")
                this.props.actions.add_deserialized_cells(data, drop_index)
            }
        })
    }

    render() {
        const styles = this.state.drag_target
            ? {
                  display: "block",
                  top: this.cell_edges[this.state.drop_index] + "px",
              }
            : {}
        return html`<dropruler style=${styles}></dropruler>`
    }
}

const argmin = (x) => {
    let best_val = Infinity
    let best_index = -1
    let val
    for (let i = 0; i < x.length; i++) {
        val = x[i]
        if (val < best_val) {
            best_index = i
            best_val = val
        }
    }
    return best_index
}

const last = (x) => x[x.length - 1]

export const get_drop_index_for_paste = (/** @type {HTMLElement} */ pluto_editor_element) => {
    /** @type {HTMLElement[]} */
    const cell_nodes = Array.from(pluto_editor_element.querySelectorAll(":scope > main > pluto-notebook > pluto-cell"))

    if (cell_nodes.length === 0) {
        return 0
    }

    const last_cell = cell_nodes[cell_nodes.length - 1]
    const cell_edges = cell_nodes.map((el) => el.offsetTop)
    cell_edges.push(last_cell.offsetTop + last_cell.scrollHeight)

    const main_element = pluto_editor_element.querySelector("main") ?? pluto_editor_element
    const main_top = main_element.getBoundingClientRect().top + document.documentElement.scrollTop
    const viewport_height = window.innerHeight ?? document.documentElement.clientHeight ?? 0
    const middle_of_viewport = document.documentElement.scrollTop + viewport_height / 2
    const editorY = middle_of_viewport - main_top

    let best_index = 0
    let best_distance = Infinity
    for (let i = 0; i < cell_edges.length; i++) {
        const distance = Math.abs(cell_edges[i] - editorY - 8)
        if (distance < best_distance) {
            best_distance = distance
            best_index = i
        }
    }

    return best_index
}
