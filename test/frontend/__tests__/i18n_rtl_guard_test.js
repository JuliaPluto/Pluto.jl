import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"

describe("i18n_rtl_guard", () => {
    const scriptPath = path.resolve(__dirname, "../helpers/i18n_rtl_guard.js")

    const runGuard = (args) => {
        const result = spawnSync("node", [scriptPath, ...args], {
            encoding: "utf8",
        })

        return {
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
        }
    }

    const writeJson = (filePath, value) => {
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    }

    const createTempWorkspace = () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "pluto-i18n-rtl-guard-"))

        fs.mkdirSync(path.join(root, "frontend", "components"), { recursive: true })
        fs.mkdirSync(path.join(root, "frontend", "styles"), { recursive: true })

        fs.writeFileSync(
            path.join(root, "frontend", "components", "Example.js"),
            `export const Example = () => html\`<div>Hello world</div><div dir=\"ltr\"></div>\`\n`,
            "utf8"
        )

        fs.writeFileSync(
            path.join(root, "frontend", "styles", "example.css"),
            `main { margin-left: 4px; }\n`,
            "utf8"
        )

        return root
    }

    it("uses baseline to allow existing findings and fails on new ones", () => {
        const root = createTempWorkspace()
        const baseline = path.join(root, "baseline.json")
        const allowlist = path.join(root, "allowlist.json")

        writeJson(allowlist, { version: 1, entries: [] })

        const baselineUpdate = runGuard(["--root", root, "--baseline", baseline, "--allowlist", allowlist, "--update-baseline"])
        expect(baselineUpdate.status).toBe(0)

        const baselineRun = runGuard(["--root", root, "--baseline", baseline, "--allowlist", allowlist])
        expect(baselineRun.status).toBe(0)

        fs.appendFileSync(path.join(root, "frontend", "styles", "example.css"), `\nmain { padding-right: 2px; }\n`, "utf8")

        const withNewFinding = runGuard(["--root", root, "--baseline", baseline, "--allowlist", allowlist])
        expect(withNewFinding.status).toBe(1)
        expect(withNewFinding.stderr).toContain("physical_direction_css")
    })

    it("respects allowlist entries", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "pluto-i18n-rtl-allow-"))

        fs.mkdirSync(path.join(root, "frontend", "components"), { recursive: true })
        fs.writeFileSync(path.join(root, "frontend", "components", "PkgTerminalView.js"), `export const x = html\`<pkg-terminal dir=\"ltr\"></pkg-terminal>\`\n`)

        const baseline = path.join(root, "baseline.json")
        const allowlist = path.join(root, "allowlist.json")

        writeJson(baseline, { version: 1, entries: [] })
        writeJson(allowlist, {
            version: 1,
            entries: [
                {
                    rule: "hardcoded_ltr_direction",
                    file: "frontend/components/PkgTerminalView.js",
                    pattern: "dir=\\\"ltr\\\"",
                    reason: "intentional",
                },
            ],
        })

        const run = runGuard(["--root", root, "--baseline", baseline, "--allowlist", allowlist])
        expect(run.status).toBe(0)
    })
})
