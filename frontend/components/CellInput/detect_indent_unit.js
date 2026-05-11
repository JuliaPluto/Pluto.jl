/**
 * Detect whether a CodeMirror document is indented with tabs or 4 spaces.
 *
 * @param {import("../../imports/CodemirrorPlutoSetup.js").Text} doc
 * @param {"\t" | "    "} fallback Returned when no indented lines are found.
 * @returns {"\t" | "    "}
 */
export const detect_indent_unit = (doc, fallback) => {
    let tab_lines = 0
    let space_lines = 0
    const max_lines = Math.min(doc.lines, 20)
    for (let i = 1; i <= max_lines; i++) {
        const text = doc.line(i).text
        if (text[0] === "\t") tab_lines++
        else if (text[0] === " " && text[1] === " ") space_lines++
    }
    if (tab_lines === 0 && space_lines === 0) return fallback
    return tab_lines >= space_lines ? "\t" : "    "
}
