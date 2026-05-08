/**
 * File System Interface for resolving Julia include() statements
 *
 * This module provides functionality to recursively resolve all include() statements
 * in Julia files, replacing them with the actual file contents.
 */
import { resolve, dirname } from "path"

/**
 * Resolve an include path relative to the current file's directory
 * @param {string} includePath - The path specified in the include() statement
 * @param {string} currentDir - Directory of the file containing the include
 * @returns {string} Absolute path to the included file
 */
function _resolveIncludePath(includePath, currentDir) {
    // Handle relative paths
    if (includePath.startsWith("./") || includePath.startsWith("../")) {
        return resolve(currentDir, includePath)
    }

    // Handle absolute paths
    if (includePath.startsWith("/")) {
        return includePath
    }

    // Handle paths relative to current directory (no ./ prefix)
    return resolve(currentDir, includePath)
}

/**
 * Recursively resolve includes for a file
 * @param {import("memfs").IFs} fs - File system instance
 * @param {Set<string>} processedFiles - Set of already processed file paths
 * @param {RegExp} includePattern - Pattern to match include statements
 * @param {string} filePath - Current file path
 * @param {string} rootPath - Root file path (for cycle detection)
 * @returns {string} Resolved file content
 */
function _resolveIncludesRecursive(fs, processedFiles, includePattern, filePath, rootPath) {
    // Resolve to absolute path
    const absolutePath = resolve(filePath)

    // Check for circular includes
    if (processedFiles.has(absolutePath)) {
        console.warn(`Circular include detected: ${absolutePath}`)
        return `# Circular include detected: ${filePath}`
    }

    // Add to processed files
    processedFiles.add(absolutePath)

    try {
        // Read the file content
        const content = fs.readFileSync(absolutePath, "utf8")

        // Process line by line to check for commented includes
        const lines = content.split("\n")
        const resolvedLines = lines.map((line) => {
            // Check if the line contains an include
            const includeMatch = line.match(includePattern)
            if (!includeMatch) {
                return line
            }

            // Check if the line is commented out (starts with # after trimming)
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith("#")) {
                // This is a commented include, leave it as is
                return line
            }

            // Process the include
            return line.replace(includePattern, (_, includePath) => {
                try {
                    // Resolve the include path relative to the current file's directory
                    const currentDir = dirname(absolutePath)
                    const resolvedIncludePath = _resolveIncludePath(includePath, currentDir)

                    // Add a comment to mark where the include was resolved
                    const includeComment = `\n# ===== Included from: ${includePath} =====\n`
                    const endComment = `\n# ===== End of ${includePath} =====\n`

                    // Recursively resolve the included file
                    const includedContent = _resolveIncludesRecursive(fs, processedFiles, includePattern, resolvedIncludePath, rootPath)

                    return includeComment + includedContent + endComment
                } catch (error) {
                    console.error(`Error resolving include "${includePath}" in ${filePath}:`, error.message)
                    return `# Error resolving include: ${includePath} - ${error.message}`
                }
            })
        })

        return resolvedLines.join("\n")
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message)
        return `# Error reading file: ${filePath} - ${error.message}`
    } finally {
        // Remove from processed files when done (allows for includes in different contexts)
        processedFiles.delete(absolutePath)
    }
}

/**
 * Read a file and recursively resolve all include() statements
 * @param {import("memfs").IFs} fs - File system instance
 * @param {string} filePath - Absolute path to the file to process
 * @returns {string} File content with all includes resolved
 */
export function resolveIncludes(fs, filePath) {
    const processedFiles = new Set()
    const includePattern = /include\(\s*["']([^"']+)["']\s*\)/g

    return _resolveIncludesRecursive(fs, processedFiles, includePattern, filePath, filePath)
}
