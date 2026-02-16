#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const TRACKING_ISSUE_URL = "https://github.com/JuliaPluto/Pluto.jl/issues/new?title=RTL+%2B+i18n+guardrail+debt+baseline"

const defaultPaths = {
    root: path.resolve(__dirname, "../../.."),
    baseline: path.resolve(__dirname, "../fixtures/i18n_rtl_guard_baseline.json"),
    allowlist: path.resolve(__dirname, "../fixtures/i18n_rtl_guard_allowlist.json"),
}

const parseArgs = (argv) => {
    const args = {
        root: defaultPaths.root,
        baseline: defaultPaths.baseline,
        allowlist: defaultPaths.allowlist,
        updateBaseline: false,
    }

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--root") {
            args.root = path.resolve(argv[++i])
        } else if (arg === "--baseline") {
            args.baseline = path.resolve(argv[++i])
        } else if (arg === "--allowlist") {
            args.allowlist = path.resolve(argv[++i])
        } else if (arg === "--update-baseline") {
            args.updateBaseline = true
        } else {
            throw new Error(`Unknown argument: ${arg}`)
        }
    }

    return args
}

const toPosix = (input) => input.split(path.sep).join("/")

const listFilesRecursive = (dir) => {
    const out = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            out.push(...listFilesRecursive(full))
        } else {
            out.push(full)
        }
    }
    return out
}

const lineAt = (content, index) => content.slice(0, index).split("\n").length

const excerptAt = (content, start, end) => {
    const raw = content.slice(start, end)
    return raw.replace(/\s+/g, " ").trim().slice(0, 160)
}

const fingerprintOf = (finding) => {
    const payload = `${finding.rule}|${finding.file}|${finding.line}|${finding.excerpt}`
    return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 20)
}

const readJson = (filePath, fallback) => {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

const matchesAllowlist = (finding, allowlistEntries) => {
    return allowlistEntries.some((entry) => {
        const ruleOk = entry.rule == null || entry.rule === finding.rule
        const fileOk = entry.file == null || entry.file === finding.file
        const patternOk =
            entry.pattern == null
                ? true
                : (() => {
                      const rx = new RegExp(entry.pattern)
                      return rx.test(finding.excerpt)
                  })()

        return ruleOk && fileOk && patternOk
    })
}

const detectHardcodedLtrDirection = (file, content, ext) => {
    const findings = []

    if (ext === ".js") {
        const rx = /dir\s*=\s*(["'])ltr\1/g
        let m
        while ((m = rx.exec(content)) != null) {
            findings.push({
                rule: "hardcoded_ltr_direction",
                file,
                line: lineAt(content, m.index),
                excerpt: excerptAt(content, m.index, m.index + m[0].length),
            })
        }
    }

    if (ext === ".css") {
        const rx = /direction\s*:\s*ltr\b/g
        let m
        while ((m = rx.exec(content)) != null) {
            findings.push({
                rule: "hardcoded_ltr_direction",
                file,
                line: lineAt(content, m.index),
                excerpt: excerptAt(content, m.index, m.index + m[0].length),
            })
        }
    }

    return findings
}

const detectPhysicalDirectionCss = (file, content, ext) => {
    if (ext !== ".css") return []

    const findings = []
    const regexes = [
        /(?:^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius)\s*:/gm,
        /text-align\s*:\s*(left|right)\b/gm,
    ]

    for (const rx of regexes) {
        let m
        while ((m = rx.exec(content)) != null) {
            const start = m.index + (m[0].startsWith(" ") || m[0].startsWith("\n") || m[0].startsWith("{") || m[0].startsWith(";") ? 1 : 0)
            findings.push({
                rule: "physical_direction_css",
                file,
                line: lineAt(content, start),
                excerpt: excerptAt(content, start, start + m[0].trim().length),
            })
        }
    }

    return findings
}

const looksLikeUserFacingLiteral = (text) => {
    const s = text.trim()
    if (s.length < 3) return false
    if (!/[A-Za-z]/.test(s)) return false
    if (/^t_[a-z0-9_]+$/i.test(s)) return false
    if (/^[#.][A-Za-z0-9_\-:.#\[\]="'\s>+~*]+$/.test(s)) return false
    if (/^(https?:|\.?\/?[A-Za-z0-9_\-./]+)$/.test(s)) return false
    if (/^[A-Za-z0-9_\-]+$/.test(s) && s.toLowerCase() === s) return false
    return true
}

const detectHardcodedUiLiteral = (file, content, ext) => {
    if (ext !== ".js") return []

    const findings = []

    // HTML text nodes inside html`...` template literals.
    const templateRx = /html`([\s\S]*?)`/g
    let m
    while ((m = templateRx.exec(content)) != null) {
        const templateBody = m[1]
        const templateOffset = m.index
        const htmlTextRx = />\s*([^<${}\n][^<${}]{1,160}?)\s*</g
        let textMatch
        while ((textMatch = htmlTextRx.exec(templateBody)) != null) {
            const text = textMatch[1].trim()
            if (!looksLikeUserFacingLiteral(text)) continue
            if (/^\d+[.)]/.test(text)) continue

            findings.push({
                rule: "hardcoded_ui_literal",
                file,
                line: lineAt(content, templateOffset + textMatch.index),
                excerpt: text,
            })
        }
    }

    // Direct user prompts.
    const promptRx = /(alert|confirm|prompt)\(\s*(["'`])([\s\S]*?)\2\s*\)/g
    while ((m = promptRx.exec(content)) != null) {
        const text = m[3].trim()
        if (!looksLikeUserFacingLiteral(text)) continue

        findings.push({
            rule: "hardcoded_ui_literal",
            file,
            line: lineAt(content, m.index),
            excerpt: text,
        })
    }

    // Common user-facing object fields in UI code.
    const fieldRx = /\b(title|description|placeholder|button_label|text)\s*:\s*(["'`])([^"'`]*?)\2/g
    while ((m = fieldRx.exec(content)) != null) {
        const text = m[3].trim()
        if (!looksLikeUserFacingLiteral(text)) continue

        findings.push({
            rule: "hardcoded_ui_literal",
            file,
            line: lineAt(content, m.index),
            excerpt: `${m[1]}: ${text}`,
        })
    }

    // De-duplicate exact duplicate excerpts in the same line/rule/file.
    const seen = new Set()
    return findings.filter((f) => {
        const key = `${f.rule}|${f.file}|${f.line}|${f.excerpt}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

const collectFindings = (root) => {
    const frontendRoot = path.join(root, "frontend")
    const files = listFilesRecursive(frontendRoot)

    const findings = []
    for (const absoluteFile of files) {
        const ext = path.extname(absoluteFile)
        if (ext !== ".js" && ext !== ".css") continue

        const relative = toPosix(path.relative(root, absoluteFile))
        const content = fs.readFileSync(absoluteFile, "utf8")

        findings.push(...detectHardcodedLtrDirection(relative, content, ext))
        findings.push(...detectPhysicalDirectionCss(relative, content, ext))
        findings.push(...detectHardcodedUiLiteral(relative, content, ext))
    }

    return findings
}

const sortFindings = (findings) =>
    [...findings].sort((a, b) => {
        if (a.rule !== b.rule) return a.rule.localeCompare(b.rule)
        if (a.file !== b.file) return a.file.localeCompare(b.file)
        if (a.line !== b.line) return a.line - b.line
        return a.excerpt.localeCompare(b.excerpt)
    })

const printSummary = (findings, prefix = "Current") => {
    const counts = findings.reduce((acc, f) => {
        acc[f.rule] = (acc[f.rule] ?? 0) + 1
        return acc
    }, {})

    console.log(`${prefix} finding counts:`)
    for (const rule of Object.keys(counts).sort()) {
        console.log(`  - ${rule}: ${counts[rule]}`)
    }
    console.log(`  - total: ${findings.length}`)
}

const main = () => {
    const args = parseArgs(process.argv.slice(2))

    const allowlist = readJson(args.allowlist, { version: 1, entries: [] })
    const baseline = readJson(args.baseline, { version: 1, entries: [] })

    const rawFindings = collectFindings(args.root)
    const filtered = rawFindings.filter((f) => !matchesAllowlist(f, allowlist.entries ?? []))

    const normalized = sortFindings(
        filtered.map((f) => ({
            ...f,
            fingerprint: fingerprintOf(f),
        }))
    )

    if (args.updateBaseline) {
        const payload = {
            version: 1,
            generated_at_utc: new Date().toISOString(),
            entries: normalized.map((f) => ({
                rule: f.rule,
                fingerprint: f.fingerprint,
                file: f.file,
                line: f.line,
                excerpt: f.excerpt,
            })),
        }

        fs.mkdirSync(path.dirname(args.baseline), { recursive: true })
        fs.writeFileSync(args.baseline, `${JSON.stringify(payload, null, 2)}\n`, "utf8")

        printSummary(normalized, "Baseline updated")
        console.log(`Wrote baseline: ${toPosix(path.relative(args.root, args.baseline))}`)
        return
    }

    const baselineFingerprints = new Set((baseline.entries ?? []).map((e) => e.fingerprint))
    const newFindings = normalized.filter((f) => !baselineFingerprints.has(f.fingerprint))

    printSummary(normalized)

    if (newFindings.length > 0) {
        console.error("\nNew i18n/RTL guardrail findings (not in baseline):")
        for (const f of newFindings) {
            console.error(`- [${f.rule}] ${f.file}:${f.line} :: ${f.excerpt}`)
        }
        console.error(`\nTracking issue: ${TRACKING_ISSUE_URL}`)
        process.exit(1)
    }

    console.log("\nNo new i18n/RTL guardrail findings.")
}

if (require.main === module) {
    try {
        main()
    } catch (error) {
        console.error(error?.stack ?? error)
        process.exit(1)
    }
}
