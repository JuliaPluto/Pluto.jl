import { Decoration, ViewPlugin, EditorView, Facet, ViewUpdate } from "../../imports/CodemirrorPlutoSetup.js"

const highlighted_line = Decoration.line({
    attributes: { class: "cm-highlighted-line" },
})

const highlighted_range = Decoration.mark({
    attributes: { class: "cm-highlighted-range" },
})

/**
 * @param {EditorView} view
 */
function create_line_decorations(view) {
    let line_number = view.state.facet(HighlightLineFacet)
    if (line_number == null || line_number == undefined || line_number < 0 || line_number > view.state.doc.lines) {
        return Decoration.set([])
    }

    let line = view.state.doc.line(line_number)
    return Decoration.set([highlighted_line.range(line.from, line.from)])
}

/**
 * @param {EditorView} view
 */
function create_range_decorations(view) {
    let range = view.state.facet(HighlightRangeFacet)
    if (range == null) {
        return Decoration.set([])
    }
    let { from, to } = range
    if (from < 0 || from == to) {
        return Decoration.set([])
    }

    // Check if range is within document bounds
    const docLength = view.state.doc.length
    if (from > docLength || to > docLength) {
        return Decoration.set([])
    }

    return Decoration.set([highlighted_range.range(from, to)])
}

/**
 * @type Facet<number?, number?>
 */
export const HighlightLineFacet = Facet.define({
    combine: (values) => values[0] ?? null,
    compare: (a, b) => a === b,
})

/**
 * @type Facet<{from: number, to: number}?, {from: number, to: number}?>
 */
export const HighlightRangeFacet = Facet.define({
    combine: (values) => values[0] ?? null,
    compare: (a, b) => a === b,
})

export const highlightLinePlugin = () =>
    ViewPlugin.fromClass(
        class {
            updateDecos(view) {
                this.decorations = create_line_decorations(view)
            }

            /**
             * @param {EditorView} view
             */
            constructor(view) {
                this.decorations = Decoration.set([])
                this.updateDecos(view)
            }

            /**
             * @param {ViewUpdate} update
             */
            update(update) {
                if (update.docChanged || update.state.facet(HighlightLineFacet) !== update.startState.facet(HighlightLineFacet)) {
                    this.updateDecos(update.view)
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )

export const highlightRangePlugin = () =>
    ViewPlugin.fromClass(
        class {
            updateDecos(view) {
                this.decorations = create_range_decorations(view)
            }

            /**
             * @param {EditorView} view
             */
            constructor(view) {
                this.decorations = Decoration.set([])
                this.updateDecos(view)
            }

            /**
             * @param {ViewUpdate} update
             */
            update(update) {
                if (update.docChanged || update.state.facet(HighlightRangeFacet) !== update.startState.facet(HighlightRangeFacet)) {
                    this.updateDecos(update.view)
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )
