/**
 * Tests for code2notebook.js functionality
 */

import { from_dyadgen, MODULE_CELL_ID, PKG_CELL_ID, EXECUTION_CELL_ID } from "./from_dyadgen.js"

// Test cases with simple Julia code examples
const testCases = [
    {
        name: "simple variable assignment",
        code: "x = 42",
        description: "Basic variable assignment",
    },
    {
        name: "function definition",
        code: `function greet(name)
    println("Hello, \$name!")
end`,
        description: "Simple function definition",
    },
    {
        name: "mathematical expression",
        code: `result = sqrt(16) + 2^3
println("Result: \$result")`,
        description: "Math operations and string interpolation",
    },
    {
        name: "array operations",
        code: `arr = [1, 2, 3, 4, 5]
sum_arr = sum(arr)
println("Sum: \$sum_arr")`,
        description: "Array creation and operations",
    },
    {
        name: "loop example",
        code: `for i in 1:5
    println("Iteration: \$i")
end`,
        description: "Simple for loop",
    },
]

function runTests() {
    console.log("🧪 Running code2notebook.js tests...\n")

    let passedTests = 0
    let totalTests = testCases.length

    for (const testCase of testCases) {
        console.log(`📋 Test: ${testCase.name}`)
        console.log(`   Description: ${testCase.description}`)

        try {
            // Test with default packages
            const notebook = from_dyadgen(testCase.code)
            console.log(`\n\n${notebook}\n\n\n\n`)
            // Validate basic structure
            const validationResults = validateNotebook(notebook, testCase.code)

            if (validationResults.valid) {
                console.log("   ✅ PASSED")
                passedTests++
            } else {
                console.log("   ❌ FAILED")
                console.log(`   Reason: ${validationResults.reason}`)
            }
        } catch (error) {
            console.log("   ❌ FAILED")
            console.log(`   Error: ${error.message}`)
        }

        console.log()
    }

    // Test with custom packages
    console.log("📋 Test: custom packages")
    try {
        const customPackages = {
            CustomPkg: {
                uuid: "12345678-1234-1234-1234-123456789abc",
                compat: "~1.0",
            },
        }

        const notebook = from_dyadgen("x = 1", customPackages)

        if (notebook.includes('CustomPkg = "12345678-1234-1234-1234-123456789abc"')) {
            console.log("   ✅ PASSED")
            passedTests++
            totalTests++
        } else {
            console.log("   ❌ FAILED - Custom package not found in notebook")
        }
    } catch (error) {
        console.log("   ❌ FAILED")
        console.log(`   Error: ${error.message}`)
        totalTests++
    }

    console.log()
    console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`)

    if (passedTests === totalTests) {
        console.log("🎉 All tests passed!")
        return true
    } else {
        console.log("⚠️  Some tests failed")
        return false
    }
}

function validateNotebook(notebook, originalCode) {
    // Check if notebook is a valid string (serialized)
    if (typeof notebook !== "string") {
        return { valid: false, reason: "Notebook should be serialized as string" }
    }

    // Check if it contains the Pluto notebook header
    if (!notebook.includes("### A Pluto.jl notebook ###")) {
        return { valid: false, reason: "Missing Pluto notebook header" }
    }

    // Check if it contains the original code
    if (!notebook.includes(originalCode)) {
        return { valid: false, reason: "Original code not found in notebook" }
    }

    // Check if it contains required cell IDs
    const requiredCells = [PKG_CELL_ID, MODULE_CELL_ID, EXECUTION_CELL_ID]
    for (const cellId of requiredCells) {
        if (!notebook.includes(cellId)) {
            return { valid: false, reason: `Missing required cell ID: ${cellId}` }
        }
    }

    // Check if it contains standard Julia imports
    if (!notebook.includes("using Markdown") || !notebook.includes("using InteractiveUtils")) {
        return { valid: false, reason: "Missing standard Julia imports" }
    }

    // Check if it contains the cell order section
    if (!notebook.includes("Cell order:")) {
        return { valid: false, reason: "Missing cell order section" }
    }

    // Check if it contains the package management cell
    if (!notebook.includes("DyadEcosystemDependencies")) {
        return { valid: false, reason: "Missing package dependencies" }
    }

    return { valid: true }
}

// Export for external use
export { runTests, validateNotebook, testCases }

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests()
}
