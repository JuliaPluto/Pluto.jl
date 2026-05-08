#!/usr/bin/env node

/**
 * Test suite for resolveIncludes function
 * This test can be run in CI environments
 */

import fs, { existsSync, writeFileSync, unlinkSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { resolveIncludes } from "../fs.js"

// Create a filesystem object that includes both fs and path methods
const filesystem = {
    ...fs,
    resolve,
    dirname,
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class TestRunner {
    constructor() {
        this.tests = []
        this.passed = 0
        this.failed = 0
    }

    test(name, testFn) {
        this.tests.push({ name, testFn })
    }

    async run() {
        console.log("🧪 Running resolveIncludes tests...\n")

        for (const { name, testFn } of this.tests) {
            try {
                await testFn()
                console.log(`✅ ${name}`)
                this.passed++
            } catch (error) {
                console.log(`❌ ${name}`)
                console.log(`   Error: ${error.message}\n`)
                this.failed++
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`)

        if (this.failed > 0) {
            process.exit(1)
        } else {
            console.log("🎉 All tests passed!")
            process.exit(0)
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message)
        }
    }

    assertIncludes(content, substring, message) {
        if (!content.includes(substring)) {
            throw new Error(message || `Expected content to include: ${substring}`)
        }
    }

    assertNotIncludes(content, substring, message) {
        if (content.includes(substring)) {
            throw new Error(message || `Expected content to NOT include: ${substring}`)
        }
    }
}

const runner = new TestRunner()

runner.test("should resolve basic includes", () => {
    const testFile = resolve(__dirname, "fixtures/test_file.jl")
    const result = resolveIncludes(filesystem, testFile)

    // Should include the content from test_shared.jl
    runner.assertIncludes(result, "const TEST_CONSTANT = 42", "Should include content from test_shared.jl")
    runner.assertIncludes(result, "# ===== Included from: ./test_shared.jl =====", "Should have include markers")
    runner.assertIncludes(result, "# ===== End of ./test_shared.jl =====", "Should have end markers")
})

runner.test("should ignore commented includes", () => {
    const testFile = resolve(__dirname, "fixtures/test_file.jl")
    const result = resolveIncludes(filesystem, testFile)

    // Commented includes should remain as comments
    runner.assertIncludes(result, '# include("commented_file.jl")', "Should preserve commented include")
    runner.assertIncludes(result, '    # include("another_commented_file.jl")', "Should preserve commented include with spaces")
    runner.assertIncludes(result, '#include("mixed_case.jl")', "Should preserve commented include without space")

    // Should not try to resolve commented files
    runner.assertNotIncludes(result, "# Error resolving include: commented_file.jl", "Should not try to resolve commented files")
})

runner.test("should handle nested includes", () => {
    const testFile = resolve(__dirname, "fixtures/main_with_nested.jl")
    const result = resolveIncludes(filesystem, testFile)

    // Should resolve the nested include chain
    runner.assertIncludes(result, "# ===== Included from: ./nested_include.jl =====", "Should resolve first level include")
    runner.assertIncludes(result, "# ===== Included from: ./test_shared.jl =====", "Should resolve nested include")
    runner.assertIncludes(result, "const TEST_CONSTANT = 42", "Should include content from deeply nested file")

    // Commented includes should still be ignored
    runner.assertIncludes(result, '# include("this_should_be_ignored.jl")', "Should ignore commented includes in nested structure")
})

runner.test("should handle missing files gracefully", () => {
    // Create a temporary test file that includes a missing file
    const tempContent = 'include("./nonexistent_file.jl")\nprint("test")'
    const tempFile = resolve(__dirname, "fixtures/temp_missing_test.jl")

    try {
        writeFileSync(tempFile, tempContent)
        const result = resolveIncludes(filesystem, tempFile)

        runner.assertIncludes(result, "# Error reading file:", "Should handle missing files with error message")
        runner.assertIncludes(result, 'print("test")', "Should continue processing after error")

        // Clean up
        unlinkSync(tempFile)
    } catch (error) {
        // Clean up even if test fails
        if (existsSync(tempFile)) {
            unlinkSync(tempFile)
        }
        throw error
    }
})

runner.test("should prevent circular includes", () => {
    // Create circular include files for testing
    const circularA = resolve(__dirname, "fixtures/circular_a.jl")
    const circularB = resolve(__dirname, "fixtures/circular_b.jl")

    try {
        writeFileSync(circularA, 'include("./circular_b.jl")\nprint("A")')
        writeFileSync(circularB, 'include("./circular_a.jl")\nprint("B")')

        const result = resolveIncludes(filesystem, circularA)

        runner.assertIncludes(result, "# Circular include detected", "Should detect and handle circular includes")

        // Clean up
        unlinkSync(circularA)
        unlinkSync(circularB)
    } catch (error) {
        // Clean up even if test fails
        ;[circularA, circularB].forEach((file) => {
            if (existsSync(file)) {
                unlinkSync(file)
            }
        })
        throw error
    }
})

runner.test("should preserve file structure and formatting", () => {
    const testFile = resolve(__dirname, "fixtures/test_file.jl")
    const result = resolveIncludes(filesystem, testFile)

    // Should preserve module structure
    runner.assertIncludes(result, "module TestModule", "Should preserve module declaration")
    runner.assertIncludes(result, "end # module", "Should preserve module end")

    // Should preserve original formatting and comments
    runner.assertIncludes(result, 'println("This is the main test file")', "Should preserve original code")
})

// Run all tests
runner.run().catch(console.error)
