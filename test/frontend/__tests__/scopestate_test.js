import { explore_variable_usage } from "../../../frontend/components/CellInput/scopestate_statefield.js"
import * as cm from "../../../frontend/imports/CodemirrorPlutoSetup.js"

const analyze = (code) => {
    const tree = cm.julia().language.parser.parse(code)
    const doc = cm.Text.of([code])
    return explore_variable_usage(tree.cursor(), doc, null, false)
}

describe("scopestate kwarg handling", () => {
    it("does not treat call-site kwargs as locals", () => {
        const locals = analyze("let x = 1; f(x; kwargzzzz=2); end").locals.map((entry) => entry.name)
        expect(locals).toContain("x")
        expect(locals).not.toContain("kwargzzzz")
    })

    it("treats function-definition kwargs as locals", () => {
        const locals = analyze("function foo(; kwargzzzz=1)\n  kwargzzzz\nend").locals.map((entry) => entry.name)
        expect(locals).toContain("kwargzzzz")
    })
})

describe("scopestate kwarg usages", () => {
    it("does not treat kwarg labels as usages", () => {
        const result = analyze("f(kwargzzzz=2)")
        const usages = result.usages.map((entry) => entry.name)
        expect(usages).not.toContain("kwargzzzz")
    })

    it("still traverses kwarg values for usages", () => {
        const usages = analyze("f(kwargzzzz=value)").usages.map((entry) => entry.name)
        expect(usages).toContain("value")
        expect(usages).not.toContain("kwargzzzz")
    })
})
