// https-resolver.js
// Custom Jest resolver that fetches ES modules from HTTPS URLs
// Written by 🤖

const https = require("https")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")

// Cache directory for downloaded modules
const cacheDir = path.join(__dirname, ".https-cache")

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
}

function urlToFilename(url) {
    const hash = crypto.createHash("md5").update(url).digest("hex")
    const urlPath = new URL(url).pathname
    const ext = path.extname(urlPath) || ".js"
    return `${hash}${ext}`
}

function downloadSync(url) {
    const cachedFile = path.join(cacheDir, urlToFilename(url))

    // Check if already cached
    if (fs.existsSync(cachedFile)) {
        return cachedFile
    }

    // Use sync-rpc or child_process to do synchronous HTTP request
    const { execSync } = require("child_process")
    try {
        const content = execSync(`curl -sL "${url}"`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
        fs.writeFileSync(cachedFile, content, "utf8")
        return cachedFile
    } catch (err) {
        throw new Error(`Failed to download ${url}: ${err.message}`)
    }
}

module.exports = (request, options) => {
    if (request.startsWith("https://")) {
        return downloadSync(request)
    }

    // Fall back to default resolver
    return options.defaultResolver(request, options)
}
