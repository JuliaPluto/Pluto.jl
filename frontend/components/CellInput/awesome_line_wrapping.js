import _ from "../../imports/lodash.js"
import { StateField, EditorView, Decoration } from "../../imports/CodemirrorPlutoSetup.js"
import { ReactWidget } from "./ReactWidget.js"
import { html } from "../../imports/Preact.js"

export const ARBITRARY_INDENT_LINE_WRAP_LIMIT = 5

export const get_leading_indent = (line, tabSize) => {
    const text = /^[\t ]*/.exec(line)?.[0] ?? ""
    let width = 0
    for (const c of text) width += c === "\t" ? tabSize : 1
    return { text, width }
}

const get_decorations = (/** @type {import("../../imports/CodemirrorPlutoSetup.js").EditorState} */ state) => {
    let decorations = []
    const max_indent_ch = ARBITRARY_INDENT_LINE_WRAP_LIMIT * state.tabSize

    // TODO? Don't create new decorations when a line hasn't changed?
    for (let i of _.range(0, state.doc.lines)) {
        let line = state.doc.line(i + 1)
        const { text: indent_text, width: indent_width } = get_leading_indent(line.text, state.tabSize)
        if (indent_width === 0) continue

        const offset = Math.min(indent_width, max_indent_ch)

        const linerwapper = Decoration.line({
            attributes: {
                style: `--indented: ${offset}ch;`,
                class: "awesome-wrapping-plugin-the-line",
            },
        })
        // Need to push before the tabs one else codemirror gets madddd
        decorations.push(linerwapper.range(line.from, line.from))

        decorations.push(
            Decoration.mark({
                class: "awesome-wrapping-plugin-the-tabs",
            }).range(line.from, line.from + indent_text.length)
        )

        // For indent past the cap, replace remaining tabs with a faded ⇥ widget.
        if (indent_width > max_indent_ch) {
            let acc = 0

            for (let j = 0; j < indent_text.length; j++) {
                const c = indent_text[j]
                const w = c === "\t" ? state.tabSize : 1
                if (acc >= max_indent_ch) {
                    const deco = Decoration.replace({
                        widget: new ReactWidget(html`<span style=${{ opacity: 0.2 }}>⇥ </span>`),
                        block: false,
                    })

                    if (c === "\t") {
                        decorations.push(deco.range(line.from + j, line.from + j + 1))
                    } else if (c === " ") {
                        // If 4 spaces are coming up...
                        if (" ".repeat(state.tabSize) === indent_text.slice(j, j + state.tabSize)) {
                            // ...then replace with single deco.
                            decorations.push(deco.range(line.from + j, line.from + j + state.tabSize))
                            // Skip to next indent unit
                            j += state.tabSize - 1
                        }
                    }
                }
                acc += w
            }
        }
    }
    return Decoration.set(decorations)
}

/**
 * Plugin that makes line wrapping in the editor respect the identation of the line.
 * It does this by adding a line decoration that adds padding-left (as much as there is indentation),
 * and adds the same amount as negative "text-indent". The nice thing about text-indent is that it
 * applies to the initial line of a wrapped line.
 */
export const awesome_line_wrapping = StateField.define({
    create(state) {
        return get_decorations(state)
    },
    update(deco, tr) {
        if (!tr.docChanged) return deco
        return get_decorations(tr.state)
    },
    provide: (f) => EditorView.decorations.from(f),
})
