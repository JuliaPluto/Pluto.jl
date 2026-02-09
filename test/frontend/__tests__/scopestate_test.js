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

const test_easy = (/** @type{string} */ code, /** @type{Partial<ScopestateTestResult>} */ expected) => {
    it(`scopestate ${code.replace("\n", ";")}`, () => {
        expect(cleanup_scopestate_testresult(analyze_easy(code))).toEqual(cleanup_scopestate_testresult(expected))
    })
}
describe("scopestate basics", () => {
    test_easy("a", { usages: ["a"] })
    test_easy(":a", {})
    test_easy("x = 3", { definitions: ["x"] })
    test_easy("x = y + 1", { definitions: ["x"], usages: ["y"] })
    test_easy("let a = 1, b = 2\n  a + b + c\nend", { locals: ["a", "b"], usages: ["a", "b", "c"] })
    test_easy("function f(x, y)\n  x + y + z\nend", { locals: ["x", "y"], usages: ["x", "y", "z"], definitions: ["f"] })
    test_easy("for i in collection\n  println(i)\nend", { locals: ["i"], usages: ["collection", "println", "i"] })
    test_easy("a, b = 1, 2", { definitions: ["a", "b"] })
    test_easy("[x^2 for x in arr]", { locals: ["x"], usages: ["arr", "x"] })
})

describe("scopestate kwarg handling", () => {
    test_easy("let x = 1; f(x; kwargzzzz=2); end", { locals: ["x"], usages: ["f", "x"] })
    test_easy("function foo(; kwargzzzz=1)\n  kwargzzzz\nend", { locals: ["kwargzzzz"], usages: ["kwargzzzz"], definitions: ["foo"] })
    test_easy("f(kwargzzzz=2)", { usages: ["f"] })
    test_easy("f(kwargzzzz=value)", { usages: ["f", "value"] })
})
