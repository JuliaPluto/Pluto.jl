let { Resolver } = require("@parcel/plugin")
let path = require("path")
let fs = require("fs/promises")
let { mkdirp } = require("mkdirp")
let { URL } = require("url")
let crypto = require("crypto")

let DONT_INCLUDE = { isExcluded: true }

const fileExists = async (path) => !!(await fs.stat(path).catch((e) => false))

async function keep_trying(fn, max_tries = 10) {
    try {
        return await fn()
    } catch (e) {
        if (max_tries === 0) {
            throw e
        } else {
            return await keep_trying(fn, max_tries - 1)
        }
    }
}

module.exports = new Resolver({
    async resolve({ specifier, dependency, options }) {
        let my_temp_cave = path.join(options.cacheDir, ".net")

        if (dependency.specifierType === "commonjs") {
            if (specifier === "process") {
                return { filePath: "/dev/null.js", code: "" }
            }
            return null
        }

        // So yeah, our sample urls aren't real urls....
        if (specifier.startsWith("sample")) {
            return DONT_INCLUDE
        }

        // Translate my cool directory structure into a real url
        if (dependency.sourcePath?.startsWith?.(my_temp_cave)) {
            let [protocol, hostname, ...path] = dependency.sourcePath.slice(my_temp_cave.length).slice(1).split("/")
            let url_object = new URL(specifier, `${protocol}://${hostname}/${path.join("/")}`)
            specifier = url_object.toString()
        }

        if (specifier.startsWith("https://") || specifier.startsWith("http://")) {
            let url = new URL(specifier)

            if (url.port !== "") throw new Error(`Port in urls not supported yet (${specifier})`)
            if (url.hash !== "") throw new Error(`Hash in urls not supported yet (${specifier})`)
            if (url.username !== "") throw new Error(`Username in urls not supported (${specifier})`)
            if (url.password !== "") throw new Error(`Password in urls not supported (${specifier})`)

            // If no file extension is given in the URL, guess one automatically.
            let found_extension = /\.[a-zA-Z][a-zA-Z0-9]+$/.exec(url.pathname)?.[0]

            let extension_to_add = found_extension ?? (dependency.specifierType === "esm" ? ".mjs" : "")

            let search_component = ""
            if (url.search !== "") {
                search_component = "." + crypto.createHmac("sha256", "42").update(url.search).digest("hex").slice(0, 10)
            }

            // If a search is given in the URL, this will search be appended to the path, so we need to repeat the extension.
            let should_add_extension = search_component !== "" || found_extension == null
            let suffix = should_add_extension ? extension_to_add : ""

            // Create a folder structure and file for the import. This folder structure will match the URL structure, to make sure that relative imports still work.
            let filename_parts = (url.pathname.slice(1) + search_component + suffix).split("/")
            let url_to_path = path.join(url.protocol.slice(0, -1), url.hostname, ...filename_parts)
            let fullpath = path.join(my_temp_cave, url_to_path)
            let folder = path.dirname(fullpath)

            if (!(await fileExists(fullpath))) {
                await keep_trying(async () => {
                    let response = await fetch(specifier)
                    if (response.status !== 200) {
                        throw new Error(`${specifier} returned ${response.status}`)
                    }
                    // Can't directly use the value from the request, as parcel really wants a string,
                    // and converting binary assets into strings and then passing them doesn't work 🤷‍♀️.
                    let buffer = await response.arrayBuffer()

                    const response_length = buffer.byteLength

                    if (response_length === 0) {
                        throw new Error(`${specifier} returned an empty reponse.`)
                    }

                    await mkdirp(folder)
                    const write_result = await fs.writeFile(fullpath, Buffer.from(buffer))

                    // Verify that the file was written correctly:
                    if (write_result !== undefined || (await fs.readFile(fullpath)).length !== response_length) {
                        throw new Error(`Failed to write file ${fullpath}`)
                    }
                })
            }

            return { filePath: fullpath }
        }

        // Relative imports from inside the CDN cache: resolve to a local file path.
        if (dependency.sourcePath?.startsWith?.(my_temp_cave) && (dependency.specifierType === "esm" || dependency.specifierType === "url")) {
            return {
                filePath: path.join(path.dirname(dependency.sourcePath), specifier),
            }
        }

        // Relative ".js" imports of TypeScript-compiled siblings: TS source convention.
        // Try .ts/.tsx fallback when the literal .js file doesn't exist.
        if (
            (specifier.startsWith("./") || specifier.startsWith("../")) &&
            specifier.endsWith(".js") &&
            dependency.sourcePath
        ) {
            let baseDir = path.dirname(dependency.sourcePath)
            let jsPath = path.join(baseDir, specifier)
            if (!(await fileExists(jsPath))) {
                for (let ext of [".ts", ".tsx"]) {
                    let candidate = jsPath.slice(0, -3) + ext
                    if (await fileExists(candidate)) {
                        return { filePath: candidate }
                    }
                }
            }
        }

        return null
    },
})
