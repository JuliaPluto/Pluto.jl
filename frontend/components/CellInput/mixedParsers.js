import {
    html,
    htmlLanguage,
    javascriptLanguage,
    markdownLanguage,
    markdown,
    parseMixed,
    PostgreSQL,
    pythonLanguage,
    sql,
    javascript,
    python,
    julia,
    parseCode,
} from "../../imports/CodemirrorPlutoSetup.js"

const htmlParser = htmlLanguage.parser
// @ts-ignore
const mdParserExt = markdownLanguage.parser.configure(parseCode({ htmlParser }))
const postgresParser = PostgreSQL.language.parser
const sqlLang = sql({ dialect: PostgreSQL })
const pythonParser = pythonLanguage.parser

/**
 * Markdown tags list; we create both `md""` and `@md("")` instances.
 */
const MD_TAGS = ["md", "mermaid", "cm", "markdown", "mdx", "mdl", "markdownliteral"].flatMap((x) => [x, `@${x}`])

/**
 * Julia strings are do not represent the exact code that is going to run
 * for example the following julia string:
 *
 * ```julia
 * """
 * const test = "five"
 * const five = \${test}
 * """
 * ```
 *
 * is going to be executed as javascript, after escaping the \$ to $
 *
 * ```javascript
 * """
 * const test = "five"
 * const five = ${test}
 * """
 * ```
 *
 * The overlays already remove the string interpolation parts of the julia string.
 * This hack additionally removes the `\` from the overlay for common interpolations, so the underlaying parser
 * will get the javascript version of the string, and not the julia version of the string (which is invalid js)
 *
 */
const overlayHack = (overlay, input) => {
    return overlay.flatMap(({ from, to }) => {
        const text = input.read(from, to)
        // const newlines = [...text.matchAll(/\\n/g)].map(({ index }) => ({ from: from + index, to: from + index + 2 }))
        // const escdollars = [...text.matchAll(/\\\$/g)].map(({ index }) => ({ from: from + index, to: from + index + 1 }))
        // const escjuliadollars = [...text.matchAll(/[^\\]\$/g)].map(({ index }) => ({ from: from + index, to: from + index + 2 }))
        // const extraOverlaysNegatives = _.sortBy([...newlines, ...escdollars, ...escjuliadollars], "from")

        // For simplicity I removed the newlines stuff and just removed the \$ from the overlays
        // Curious to see edge cases that this misses - DRAL

        const result = []
        let last_content_start = from
        for (let { index: relative_escape_start } of text.matchAll(/\\\$/g)) {
            let next_escape_start = from + relative_escape_start
            if (last_content_start !== next_escape_start) {
                result.push({ from: last_content_start, to: next_escape_start })
            }
            last_content_start = next_escape_start + 1
        }
        if (last_content_start !== to) {
            result.push({ from: last_content_start, to: to })
        }
        return result
    })
}

export const STRING_NODE_NAMES = new Set(["StringLiteral", "CommandLiteral", "NsStringLiteral", "NsCommandLiteral"])

const juliaWrapper = parseMixed((cursor, input) => {
    if (cursor.name !== "NsStringLiteral" && cursor.name !== "StringLiteral") {
        return null
    }

    const node = cursor.node
    const first_string_delim = node.getChild('"""') ?? node.getChild('"')
    if (first_string_delim == null) return null
    const last_string_delim = node.lastChild
    if (last_string_delim == null) return null

    // const offset = first_string_delim.to - first_string_delim.from
    // console.log({ first_string_delim, last_string_delim, offset })
    const string_content_from = first_string_delim.to
    const string_content_to = Math.min(last_string_delim.from, input.length)

    if (string_content_from >= string_content_to) {
        return null
    }

    let tagNode
    if (cursor.name === "NsStringLiteral") {
        tagNode = node.firstChild
        // if (tagNode) tag = input.read(tagNode.from, tagNode.to)
    } else {
        // must be a string, let's search for the parent `@htl`.
        const start = node
        const p1 = start.parent
        if (p1 != null && p1.name === "Arguments") {
            const p2 = p1.parent
            if (p2 != null && p2.name === "MacrocallExpression") {
                tagNode = p2.getChild("MacroIdentifier")
            }
        }
    }

    if (tagNode == null) return null

    const is_macro = tagNode.name === "MacroIdentifier"

    const tag = input.read(tagNode.from, tagNode.to)
    let parser = null
    if (tag === "@htl" || tag === "html") {
        parser = htmlParser
    } else if (MD_TAGS.includes(tag)) {
        parser = mdParserExt
    } else if (tag === "@javascript" || tag === "@js" || tag === "js" || tag === "javascript") {
        parser = javascriptLanguage.parser
    } else if (tag === "py" || tag === "pyr" || tag === "python" || tag === "@python") {
        parser = pythonParser
    } else if (tag === "sql") {
        parser = postgresParser
    } else {
        return null
    }

    let overlay = []
    if (node.firstChild != null) {
        let last_content_start = string_content_from
        let child = node.firstChild.cursor()

        do {
            if (last_content_start < child.from) {
                overlay.push({ from: last_content_start, to: child.from })
            }
            last_content_start = child.to
        } while (child.nextSibling())
        if (last_content_start < string_content_to) {
            overlay.push({ from: last_content_start, to: string_content_to })
        }
    } else {
        overlay = [{ from: string_content_from, to: string_content_to }]
    }

    // If it is a macro, thus supports interpolations (prefixed strings only have faux-interpolations) but not raw strings (`\n` will be a newline, for the character `\n` you need to do `\\n`)
    // we need to remove `\$` (which should just be `$` in the javascript)
    if (is_macro) {
        overlay = overlayHack(overlay, input)
    }

    // No overlays for markdown yet
    // (They sometimes work, but sometimes also randomly crash when adding an interpolation
    //  I guess this has something to do with the fact that markdown isn't parsed with lezer,
    //  but has some custom made thing that emulates lezer.)
    if ([...MD_TAGS].includes(tag)) {
        return { parser, overlay: [{ from: string_content_from, to: string_content_to }] }
    }

    return { parser, overlay }
})

const julia_mixed = (config) => {
    const julia_simple = julia(config)
    // @ts-ignore
    julia_simple.language.parser = julia_simple.language.parser.configure({ wrap: juliaWrapper })
    return julia_simple
}

export { julia_mixed, sqlLang, pythonLanguage, javascript, htmlLanguage, javascriptLanguage, python, markdown, html }
