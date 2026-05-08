// @ts-nocheck
// This is "just" https://github.com/codemirror/comment/blob/da336b8660dedab23e06ced2b430f2ac56ef202d/src/comment.ts
// (@codemirror/comment)
// But with a change that helps mixed parser environments:
// If the comment-style (`#`, `//`, `/* */`, etc) at the begin and end of the selection is the same,
// we don't use the comment-style per line, but use the begin/end style for every line.

import { EditorSelection, EditorState } from "../../imports/CodemirrorPlutoSetup.js"

/// Comment or uncomment the current selection. Will use line comments
/// if available, otherwise falling back to block comments.
export const toggleComment = (target) => {
    let config = getConfig(target.state)
    return config.line ? toggleLineComment(target) : config.block ? toggleBlockComment(target) : false
}
function command(f, option) {
    return ({ state, dispatch }) => {
        if (state.readOnly) return false
        let tr = f(option, state.selection.ranges, state)
        if (!tr) return false
        dispatch(state.update(tr))
        return true
    }
}
/// Comment or uncomment the current selection using line comments.
/// The line comment syntax is taken from the
/// [`commentTokens`](#comment.CommentTokens) [language
/// data](#state.EditorState.languageDataAt).
export const toggleLineComment = command(changeLineComment, 0 /* Toggle */)
/// Comment the current selection using line comments.
export const lineComment = command(changeLineComment, 1 /* Comment */)
/// Uncomment the current selection using line comments.
export const lineUncomment = command(changeLineComment, 2 /* Uncomment */)
/// Comment or uncomment the current selection using block comments.
/// The block comment syntax is taken from the
/// [`commentTokens`](#comment.CommentTokens) [language
/// data](#state.EditorState.languageDataAt).
export const toggleBlockComment = command(changeBlockComment, 0 /* Toggle */)
/// Comment the current selection using block comments.
export const blockComment = command(changeBlockComment, 1 /* Comment */)
/// Uncomment the current selection using block comments.
export const blockUncomment = command(changeBlockComment, 2 /* Uncomment */)
/// Default key bindings for this package.
///
///  - Ctrl-/ (Cmd-/ on macOS): [`toggleComment`](#comment.toggleComment).
///  - Shift-Alt-a: [`toggleBlockComment`](#comment.toggleBlockComment).
export const commentKeymap = [
    { key: "Mod-/", run: toggleComment },
    { key: "Alt-A", run: toggleBlockComment },
]
function getConfig(state, pos = state.selection.main.head) {
    let data = state.languageDataAt("commentTokens", pos)
    return data.length ? data[0] : {}
}
const SearchMargin = 50
/// Determines if the given range is block-commented in the given
/// state.
function findBlockComment(state, { open, close }, from, to) {
    let textBefore = state.sliceDoc(from - SearchMargin, from)
    let textAfter = state.sliceDoc(to, to + SearchMargin)
    let spaceBefore = /\s*$/.exec(textBefore)[0].length,
        spaceAfter = /^\s*/.exec(textAfter)[0].length
    let beforeOff = textBefore.length - spaceBefore
    if (textBefore.slice(beforeOff - open.length, beforeOff) == open && textAfter.slice(spaceAfter, spaceAfter + close.length) == close) {
        return { open: { pos: from - spaceBefore, margin: spaceBefore && 1 }, close: { pos: to + spaceAfter, margin: spaceAfter && 1 } }
    }
    let startText, endText
    if (to - from <= 2 * SearchMargin) {
        startText = endText = state.sliceDoc(from, to)
    } else {
        startText = state.sliceDoc(from, from + SearchMargin)
        endText = state.sliceDoc(to - SearchMargin, to)
    }
    let startSpace = /^\s*/.exec(startText)[0].length,
        endSpace = /\s*$/.exec(endText)[0].length
    let endOff = endText.length - endSpace - close.length
    if (startText.slice(startSpace, startSpace + open.length) == open && endText.slice(endOff, endOff + close.length) == close) {
        return {
            open: { pos: from + startSpace + open.length, margin: /\s/.test(startText.charAt(startSpace + open.length)) ? 1 : 0 },
            close: { pos: to - endSpace - close.length, margin: /\s/.test(endText.charAt(endOff - 1)) ? 1 : 0 },
        }
    }
    return null
}
// Performs toggle, comment and uncomment of block comments in
// languages that support them.
function changeBlockComment(option, ranges, state) {
    let tokens = ranges.map((r) => getConfig(state, r.from).block)
    if (!tokens.every((c) => c)) return null
    let comments = ranges.map((r, i) => findBlockComment(state, tokens[i], r.from, r.to))
    if (option != 2 /* Uncomment */ && !comments.every((c) => c)) {
        let index = 0
        return state.changeByRange((range) => {
            let { open, close } = tokens[index++]
            if (comments[index]) return { range }
            let shift = open.length + 1
            return {
                changes: [
                    { from: range.from, insert: open + " " },
                    { from: range.to, insert: " " + close },
                ],
                range: EditorSelection.range(range.anchor + shift, range.head + shift),
            }
        })
    } else if (option != 1 /* Comment */ && comments.some((c) => c)) {
        let changes = []
        for (let i = 0, comment; i < comments.length; i++)
            if ((comment = comments[i])) {
                let token = tokens[i],
                    { open, close } = comment
                changes.push(
                    { from: open.pos - token.open.length, to: open.pos + open.margin },
                    { from: close.pos - close.margin, to: close.pos + token.close.length }
                )
            }
        return { changes }
    }
    return null
}
// Performs toggle, comment and uncomment of line comments.
function changeLineComment(option, ranges, state) {
    let lines = []
    let prevLine = -1
    for (let { from, to } of ranges) {
        // DRAL EDIIIIIITS
        // If the comment tokens at the begin and end are the same,
        // I assume we want these for the whole range!
        let comment_token_from = getConfig(state, from).line
        let comment_token_to = getConfig(state, to).line
        let overwrite_token = comment_token_from === comment_token_to ? comment_token_from : null

        let startI = lines.length,
            minIndent = 1e9
        for (let pos = from; pos <= to; ) {
            let line = state.doc.lineAt(pos)
            if (line.from > prevLine && (from == to || to > line.from)) {
                prevLine = line.from
                // DRAL EDIIIIIIIITS
                let token = overwrite_token ?? getConfig(state, pos).line
                if (!token) continue
                let indent = /^\s*/.exec(line.text)[0].length
                let empty = indent == line.length
                let comment = line.text.slice(indent, indent + token.length) == token ? indent : -1
                if (indent < line.text.length && indent < minIndent) minIndent = indent
                lines.push({ line, comment, token, indent, empty, single: false })
            }
            pos = line.to + 1
        }
        if (minIndent < 1e9) for (let i = startI; i < lines.length; i++) if (lines[i].indent < lines[i].line.text.length) lines[i].indent = minIndent
        if (lines.length == startI + 1) lines[startI].single = true
    }
    if (option != 2 /* Uncomment */ && lines.some((l) => l.comment < 0 && (!l.empty || l.single))) {
        let changes = []
        for (let { line, token, indent, empty, single } of lines) if (single || !empty) changes.push({ from: line.from + indent, insert: token + " " })
        let changeSet = state.changes(changes)
        return { changes: changeSet, selection: state.selection.map(changeSet, 1) }
    } else if (option != 1 /* Comment */ && lines.some((l) => l.comment >= 0)) {
        let changes = []
        for (let { line, comment, token } of lines)
            if (comment >= 0) {
                let from = line.from + comment,
                    to = from + token.length
                if (line.text[to - line.from] == " ") to++
                changes.push({ from, to })
            }
        return { changes }
    }
    return null
}
