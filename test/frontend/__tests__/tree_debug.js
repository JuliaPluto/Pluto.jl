import * as cm from "../../../frontend/imports/CodemirrorPlutoSetup.js"

const printTree = (code) => {
    const tree = cm.julia().language.parser.parse(code)
    const doc = cm.Text.of([code])
    
    console.log("\n=== " + code + " ===")
    
    tree.cursor().iterate((cursor) => {
        const depth = cursor.node.parent ? getDepth(cursor.node) : 0
        const indent = "  ".repeat(depth)
        const text = doc.sliceString(cursor.from, cursor.to).replace(/\n/g, "\\n")
        console.log(`${indent}${cursor.name}[${cursor.from},${cursor.to}]: "${text}"`)
    })
}

const getDepth = (node, d = 0) => {
    if (!node.parent) return d
    return getDepth(node.parent, d + 1)
}

describe("tree debug", () => {
    it("prints tree structure", () => {
        printTree("try\n using Pluto.wow, Dates\n catch\n end")
        printTree("try\n catch\n end")
    })
})
