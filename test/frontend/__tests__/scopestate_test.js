import { explore_variable_usage } from "../../../frontend/components/CellInput/scopestate_statefield.js"
import * as cm from "../../../frontend/imports/CodemirrorPlutoSetup.js"

const analyze = (code) => {
    const tree = cm.julia().language.parser.parse(code)
    const doc = cm.Text.of([code])
    return explore_variable_usage(tree.cursor(), doc, null, false)
}

// It would be cool to split the usages into global and local, using the range information stored in `locals`. Then we can test if usages are properly detected as a local usage.

/**
 * @typedef {Object} ScopestateTestResult
 * @property {string[]} locals All local variable definitions.
 * @property {string[]} usages All variable usages, both global and local.
 * @property {string[]} definitions All global variable definitions.
 */

const analyze_easy = (code) => {
    const scst = analyze(code)
    /** @type {ScopestateTestResult} */
    return {
        locals: scst.locals.map((entry) => entry.name),
        usages: scst.usages.map((entry) => entry.name),
        definitions: [...scst.definitions.keys()],
    }
}

const cleanup_scopestate_testresult = (/** @type {Partial<ScopestateTestResult>} */ result) =>
    /** @type {ScopestateTestResult} */ ({
        locals: result.locals ? result.locals.sort() : [],
        usages: result.usages ? result.usages.sort() : [],
        definitions: result.definitions ? result.definitions.sort() : [],
    })

const getDepth = (node, d = 0) => {
    if (!node.parent) return d
    return getDepth(node.parent, d + 1)
}

// Written by 🤖
const printTree = (code) => {
    // ANSI color codes
    const c = {
        reset: "\x1b[0m",
        bold: "\x1b[1m",
        dim: "\x1b[2m",
        cyan: "\x1b[36m",
        yellow: "\x1b[33m",
        green: "\x1b[32m",
        magenta: "\x1b[35m",
        red: "\x1b[31m",
    }

    const tree = cm.julia().language.parser.parse(code)
    const doc = cm.Text.of([code])

    const lines = [`\n${c.bold}${c.cyan}=== Parse tree for: ${c.yellow}${code.replace(/\n/g, "\\n")}${c.cyan} ===${c.reset}`]

    tree.cursor().iterate((cursor) => {
        const depth = cursor.node.parent ? getDepth(cursor.node) : 0
        const indent = "  ".repeat(depth)
        const text = doc.sliceString(cursor.from, cursor.to).replace(/\n/g, "\\n")
        const isError = cursor.name === "⚠"
        const nameColor = isError ? c.red : c.cyan
        lines.push(`${indent}${nameColor}${cursor.name}${c.reset}${c.magenta}[${cursor.from},${cursor.to}]${c.reset}: ${c.green}"${text}"${c.reset}`)
    })

    console.log(lines.join("\n"))
}

const test_easy = (/** @type{string} */ code, /** @type{Partial<ScopestateTestResult>} */ expected) => {
    it(`scopestate ${code.replace("\n", ";")}`, () => {
        const actual = cleanup_scopestate_testresult(analyze_easy(code))
        const expectedClean = cleanup_scopestate_testresult(expected)
        try {
            expect(actual).toEqual(expectedClean)
        } catch (e) {
            printTree(code)
            throw e
        }
    })
}
describe("scopestate basics", () => {
    test_easy("a", { usages: ["a"] })
    test_easy(":a", {})
    test_easy("a:b", { usages: ["a", "b"] })
    test_easy("a : b", { usages: ["a", "b"] })
    test_easy("x = 3", { definitions: ["x"] })
    test_easy("x = y + 1", { definitions: ["x"], usages: ["y"] })
    test_easy("let a = 1, b = 2\n  a + b + c\nend", { locals: ["a", "b"], usages: ["a", "b", "c"] })
    test_easy("function f(x, y)\n  x + y + z\nend", { locals: ["x", "y"], usages: ["x", "y", "z"], definitions: ["f"] })
    test_easy("for i in collection\n  println(i)\nend", { locals: ["i"], usages: ["collection", "println", "i"] })
    test_easy("a, b = 1, 2", { definitions: ["a", "b"] })
    test_easy("[x^2 for x in arr]", { locals: ["x"], usages: ["arr", "x"] })
})

describe("scopestate import handling", () => {
    test_easy("import Pluto", { definitions: ["Pluto"] })
    test_easy("import Pluto: wow", { definitions: ["wow"] })
    test_easy("import Pluto.ExpressionExplorer.wow, Plutowie", { definitions: ["wow", "Plutowie"] })
    test_easy("import .Pluto: wow", { definitions: ["wow"] })
    test_easy("import ..Pluto: wow", { definitions: ["wow"] })
    test_easy("let; import Pluto.wow, Dates; end", { definitions: ["wow", "Dates"] })
    test_easy("while false; import Pluto.wow, Dates; end", { definitions: ["wow", "Dates"] })
    test_easy("try\n using Pluto.wow, Dates\n catch\n end", { definitions: ["wow", "Dates"] })
})

describe("scopestate kwarg handling", () => {
    test_easy("let x = 1; f(x; kwargzzzz=2); end", { locals: ["x"], usages: ["f", "x"] })
    test_easy("function foo(; kwargzzzz=1)\n  kwargzzzz\nend", { locals: ["kwargzzzz"], usages: ["kwargzzzz"], definitions: ["foo"] })
    test_easy("f(kwargzzzz=2)", { usages: ["f"] })
    test_easy("f(kwargzzzz=value)", { usages: ["f", "value"] })
})
