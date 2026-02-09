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
    // Ported from ExpressionExplorer.jl test suite
    test_easy("a", { usages: ["a"] })
    test_easy(":a", {})
    test_easy("a:b", { usages: ["a", "b"] })
    test_easy("a : b", { usages: ["a", "b"] })
    test_easy("x = 3", { definitions: ["x"] })
    test_easy("x = x", { definitions: ["x"], usages: ["x"] })
    test_easy("x = y + 1", { definitions: ["x"], usages: ["y"] })
    test_easy("x = +(a...)", { definitions: ["x"], usages: ["a"] })
    test_easy("1:3", {})
    // Note: function calls like sqrt(1) track the function name as a usage
    test_easy("sqrt(1)", { usages: ["sqrt"] })
    test_easy("1 + 1", {})
    test_easy("let a = 1, b = 2\n  a + b + c\nend", { locals: ["a", "b"], usages: ["a", "b", "c"] })
    test_easy("function f(x, y)\n  x + y + z\nend", { locals: ["x", "y"], usages: ["x", "y", "z"], definitions: ["f"] })
    test_easy("for i in collection\n  println(i)\nend", { locals: ["i"], usages: ["collection", "println", "i"] })
    test_easy("a, b = 1, 2", { definitions: ["a", "b"] })
    test_easy("[x^2 for x in arr]", { locals: ["x"], usages: ["arr", "x"] })
})

describe("scopestate lists and structs", () => {
    // Ported from ExpressionExplorer.jl test suite
    // Note: JS scopestate does not track function calls like `:` as separate category

    // Range expressions
    test_easy("1:3", {})
    test_easy("a[1:3,4]", { usages: ["a"] })
    test_easy("a[b]", { usages: ["a", "b"] })
    test_easy("[a[1:3,4]; b[5]]", { usages: ["a", "b"] })

    // Field access
    test_easy("a.someproperty", { usages: ["a"] })

    // Splat in array
    test_easy("[a..., b]", { usages: ["a", "b"] })

    // Struct definitions - struct name is a definition
    test_easy("struct a; b; c; end", { definitions: ["a"] })
    test_easy("abstract type a end", { definitions: ["a"] })
    // ⚠️ parse error: lezer parser doesn't handle struct/abstract inside let properly
    // test_easy("let struct a; b; c; end end", { definitions: ["a"] })
    // test_easy("let abstract type a end end", { definitions: ["a"] })
    test_easy("let\n struct a; b; c; end\n end", { definitions: ["a"] })
    test_easy("let\n abstract type a end\n end", { definitions: ["a"] })

    // Primitive type definitions
    test_easy("primitive type Int24 24 end", { definitions: ["Int24"] })
    test_easy("primitive type Int24 <: Integer 24 end", { definitions: ["Int24"] })
    // ⚠️ parse error: lezer parser doesn't handle variable as size in primitive type
    // test_easy("primitive type Int24 <: Integer size end", { definitions: ["Int24"], usages: ["Integer", "size"] })

    // Module definitions - module name is a definition, contents are not tracked
    test_easy("module a; f(x) = x; z = r end", { definitions: ["a"] })
})

describe("scopestate types", () => {
    // Ported from ExpressionExplorer.jl test suite
    // Note: JS scopestate does not track inner struct/type references

    // Type annotations in assignments
    test_easy("x::Foo = 3", { definitions: ["x"], usages: ["Foo"] })
    test_easy("x::Foo", { usages: ["x", "Foo"] })
    test_easy("a::Foo, b::String = 1, 2", { definitions: ["a", "b"], usages: ["Foo", "String"] })

    // Type indexing and isa
    test_easy("Foo[]", { usages: ["Foo"] })
    // Note: `isa` is a keyword in the lezer parser, not tracked as an identifier usage
    test_easy("x isa Foo", { usages: ["x", "Foo"] })

    // Index assignment with type annotation: (x[])::Int = 1 - does NOT define x
    test_easy("(x[])::Int = 1", { usages: ["Int", "x"] })
    test_easy("(x[])::Int, y = 1, 2", { definitions: ["y"], usages: ["Int", "x"] })

    // Type alias definitions
    test_easy("A{B} = B", { definitions: ["A"], usages: ["B"] })
    test_easy("A{T} = Union{T,Int}", { definitions: ["A"], usages: ["T", "Int", "Union"] })

    // Abstract type definitions (already covered in lists and structs, but with more variations)
    test_easy("abstract type a end", { definitions: ["a"] })
    test_easy("abstract type a <: b end", { definitions: ["a"] })
    test_easy("abstract type a <: b{C} end", { definitions: ["a"] })
    test_easy("abstract type a{T} end", { definitions: ["a"] })
    test_easy("abstract type a{T,S} end", { definitions: ["a"] })
    test_easy("abstract type a{T} <: b end", { definitions: ["a"] })
    test_easy("abstract type a{T} <: b{T} end", { definitions: ["a"] })

    // Struct definitions (basic - already tested, but include for completeness)
    test_easy("struct a end", { definitions: ["a"] })
    test_easy("struct a <: b; c; d::Foo; end", { definitions: ["a"] })
    test_easy("struct a{T,S}; c::T; d::Foo; end", { definitions: ["a"] })
    test_easy("struct a{T} <: b; c; d::Foo; end", { definitions: ["a"] })
    test_easy("struct a{T} <: b{T}; c; d::Foo; end", { definitions: ["a"] })
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

describe("scopestate assignment operator & modifiers", () => {
    // Ported from ExpressionExplorer.jl test suite
    // Written by 🤖
    // Note: JS scopestate does not track function calls as separate category, only variable usages/definitions

    // Basic assignments
    test_easy("a = a", { definitions: ["a"], usages: ["a"] })
    test_easy("a = a + 1", { definitions: ["a"], usages: ["a"] })
    test_easy("x = a = a + 1", { definitions: ["a", "x"], usages: ["a"] })
    test_easy("const a = b", { definitions: ["a"], usages: ["b"] })

    // Short function definition creates a function definition, not a variable assignment
    test_easy("f(x) = x", { definitions: ["f"], locals: ["x"], usages: ["x"] })

    // Index assignment: a[b,c,:] = d - does NOT define a, but uses a, b, c, d
    test_easy("a[b,c,:] = d", { usages: ["a", "b", "c", "d"] })

    // Field assignment: a.b = c - does NOT define a, but uses a and c
    test_easy("a.b = c", { usages: ["a", "c"] })

    // Function call with kwargs
    test_easy("f(a, b=c, d=e; f=g)", { usages: ["a", "c", "e", "f", "g"] })

    // Compound assignment operators
    test_easy("a += 1", { definitions: ["a"], usages: ["a"] })
    test_easy("a >>>= 1", { definitions: ["a"], usages: ["a"] })
    test_easy("a ⊻= 1", { definitions: ["a"], usages: ["a"] })

    // Index compound assignment: a[1] += 1 - does NOT define a
    test_easy("a[1] += 1", { usages: ["a"] })

    // Let with compound assignment
    test_easy("x = let a = 1; a += b end", { definitions: ["x"], locals: ["a"], usages: ["a", "b"] })

    // Underscore handling: _ is not a real variable
    test_easy("_ = a + 1", { usages: ["a"] })
    test_easy("a = _ + 1", { definitions: ["a"] })

    // Index assignment with function call
    test_easy("f()[] = 1", { usages: ["f"] })
    test_easy("x[f()] = 1", { usages: ["f", "x"] })
})
