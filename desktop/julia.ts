// Julia installation knowledge for the desktop shell: which juliaup channels exist, which one
// the user prefers, and where settings live. juliaup state is read from its own metadata file
// (~/.julia/juliaup/juliaup.json) — structured and stable, no CLI output parsing.

// Windows has no HOME by convention, but Git Bash / MSYS2 set one — and it points somewhere Julia's
// own homedir() never looks (that resolves the user profile). The two MUST agree: the server writes
// its connection file under homedir(), and boot.ts reads the access secret back out of it. So
// USERPROFILE wins on Windows, HOME everywhere else.
export const home_dir = () =>
    (Deno.build.os === "windows" ? (Deno.env.get("USERPROFILE") ?? Deno.env.get("HOME")) : (Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE"))) ?? "."

export const data_dir = () =>
    Deno.build.os === "darwin"
        ? `${home_dir()}/Library/Application Support/SpaceStation`
        : Deno.build.os === "windows"
          ? `${Deno.env.get("APPDATA") ?? home_dir()}/SpaceStation`
          : `${Deno.env.get("XDG_DATA_HOME") ?? `${home_dir()}/.local/share`}/spacestation`

export type JuliaSettings = { channel: string | null; ask: boolean }

const settings_path = () => `${data_dir()}/settings.json`

export const load_settings = (): { julia?: JuliaSettings } => {
    try {
        return JSON.parse(Deno.readTextFileSync(settings_path()))
    } catch {
        return {}
    }
}

export const save_settings = (patch: Record<string, unknown>) => {
    try {
        Deno.mkdirSync(data_dir(), { recursive: true })
        Deno.writeTextFileSync(settings_path(), JSON.stringify({ ...load_settings(), ...patch }, null, 2))
    } catch (e) {
        console.warn("could not save settings:", e)
    }
}

const deno_target = () => {
    const arch = Deno.build.arch === "aarch64" ? "aarch64" : "x86_64"
    return Deno.build.os === "darwin" ? `${arch}-apple-darwin` : Deno.build.os === "windows" ? `${arch}-pc-windows-msvc` : `${arch}-unknown-linux-gnu`
}

/** The bundle ships juliaup's PORTABLE build (vendor_juliaup.ts): a static `juliaup` + a `julia`
 *  launcher, so a machine with NO Julia needs no installer script — on Windows too. Executables
 *  can't run from the compiled VFS, so materialize them into the app-data dir once. */
export const vendored_bin_dir = (): string | null => {
    const exe = Deno.build.os === "windows" ? ".exe" : ""
    const out = `${data_dir()}/juliaup-portable`
    const names = [`juliaup${exe}`, `julia${exe}`]
    try {
        for (const n of names) Deno.statSync(`${out}/${n}`)
        return out
    } catch {
        // not materialized yet
    }
    try {
        const src = new URL(`./vendor/${deno_target()}/`, import.meta.url)
        Deno.mkdirSync(out, { recursive: true })
        for (const n of names) {
            Deno.writeFileSync(`${out}/${n}`, Deno.readFileSync(new URL(n, src)))
            if (exe === "") Deno.chmodSync(`${out}/${n}`, 0o755)
        }
        return out
    } catch {
        return null // built without vendored binaries — install paths fall back to the script
    }
}

export const juliaup_bin = (): string | null => {
    const exe = Deno.build.os === "windows" ? "juliaup.exe" : "juliaup"
    for (const candidate of [`${home_dir()}/.juliaup/bin/${exe}`, `/opt/homebrew/bin/${exe}`, `/usr/local/bin/${exe}`]) {
        try {
            Deno.statSync(candidate)
            return candidate
        } catch {
            // keep looking
        }
    }
    const vendored = vendored_bin_dir()
    return vendored == null ? null : `${vendored}/${exe}`
}

export type JuliaupInfo = { default: string | null; channels: Array<{ name: string; version: string }> }

/** Installed channels + default, from juliaup's own metadata. Null when juliaup isn't set up. */
export const juliaup_info = (): JuliaupInfo | null => {
    try {
        // JULIA_DEPOT_PATH is a LIST, separated the way the platform separates path lists — ';' on
        // Windows, ':' elsewhere. Splitting on ':' everywhere truncated "C:\Users\me\.julia" to "C".
        const depot_sep = Deno.build.os === "windows" ? ";" : ":"
        const depot = Deno.env.get("JULIAUP_DEPOT_PATH") ?? Deno.env.get("JULIA_DEPOT_PATH")?.split(depot_sep)[0] ?? `${home_dir()}/.julia`
        const meta = JSON.parse(Deno.readTextFileSync(`${depot}/juliaup/juliaup.json`))
        const channels = Object.entries(meta.InstalledChannels ?? {})
            .map(([name, v]: [string, any]) => ({ name, version: String(v?.Version ?? "").split("+")[0] }))
            .sort((a, b) => (a.name === meta.Default ? -1 : b.name === meta.Default ? 1 : a.name.localeCompare(b.name, undefined, { numeric: true })))
        return { default: meta.Default ?? null, channels }
    } catch {
        return null
    }
}

// (the curated shortlist was replaced by the real catalog — julia_catalog below)

/** Version-ish compare: "1.12.7" > "1.12.6", release > its prereleases ("1.13.0" > "1.13.0-rc1"). */
export const cmp_ver = (a: string, b: string): number => {
    const parse = (v: string) => {
        const [base, ...pre] = v.split("-")
        return { nums: base.split(".").map((n) => parseInt(n, 10) || 0), pre: pre.join("-") }
    }
    const pa = parse(a)
    const pb = parse(b)
    for (let i = 0; i < Math.max(pa.nums.length, pb.nums.length); i++) {
        const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0)
        if (d !== 0) return d
    }
    if (pa.pre === pb.pre) return 0
    if (pa.pre === "") return 1 // release beats prerelease
    if (pb.pre === "") return -1
    return pa.pre < pb.pre ? -1 : 1
}

/** The full juliaup catalog (`juliaup list` — the one juliaup datum with no metadata file; a
 *  stable two-column table, parsed tolerantly and cached). Null when juliaup is absent. */
let list_cache: { at: number; rows: Array<{ name: string; version: string }> } | null = null
export const juliaup_list = async (): Promise<Array<{ name: string; version: string }> | null> => {
    if (list_cache != null && Date.now() - list_cache.at < 5 * 60_000) return list_cache.rows
    const bin = juliaup_bin()
    if (bin == null) return null
    try {
        const out = await new Deno.Command(bin, { args: ["list"], stdout: "piped", stderr: "null" }).output()
        if (!out.success) return null
        const rows: Array<{ name: string; version: string }> = []
        for (const line of new TextDecoder().decode(out.stdout).split("\n")) {
            const m = line.match(/^\s*(\S+)\s+(\S+)\s*$/)
            if (m == null || m[1] === "Channel" || m[1].startsWith("-")) continue
            if (m[1].includes("~")) continue // arch-pinned variants: noise in a picker
            rows.push({ name: m[1], version: m[2].split("+")[0] })
        }
        list_cache = { at: Date.now(), rows }
        return rows
    } catch {
        return null
    }
}

/** Everything the Launch Station's "get another version" UI needs, from the real catalog:
 *  aliases (release/lts/…), recent minor channels, every concrete version for the free-text
 *  picker, and per-installed-channel updates (installed 1.12.6, catalog says 1.12 → 1.12.7). */
export const julia_catalog = async (): Promise<{
    aliases: Array<{ name: string; version: string }>
    minors: Array<{ name: string; version: string }>
    versions: string[]
    updates: Record<string, string>
} | null> => {
    const rows = await juliaup_list()
    if (rows == null) return null
    const by = new Map(rows.map((r) => [r.name, r.version]))
    const aliases = ["release", "lts", "beta", "rc", "nightly"].filter((n) => by.has(n)).map((n) => ({ name: n, version: by.get(n)! }))
    const modern = (v: string) => cmp_ver(v, "1.6") >= 0
    const minors = rows.filter((r) => /^\d+\.\d+$/.test(r.name) && modern(r.version)).sort((a, b) => cmp_ver(b.name + ".0", a.name + ".0"))
    const versions = rows
        .filter((r) => /^\d+\.\d+\.\d+/.test(r.name) && modern(r.version))
        .map((r) => r.name)
        .sort((a, b) => cmp_ver(b, a))
    const updates: Record<string, string> = {}
    for (const ch of juliaup_info()?.channels ?? []) {
        const latest = by.get(ch.name)
        if (latest != null && ch.version !== "" && cmp_ver(latest, ch.version) > 0) updates[ch.name] = latest
    }
    return { aliases, minors, versions, updates }
}

/** Pkg.Apps puts the `spacestation` shim in ~/.julia/bin — but nothing puts that directory on
 *  PATH (Pkg just prints a hint). The desktop finishes the job, idempotently and best-effort:
 *  a guarded export line in the shell rc files (macOS/Linux — skipped when anything already
 *  references .julia/bin), or the User PATH registry value on Windows (via [Environment]::…,
 *  never `setx`, which truncates and flattens). New terminals pick it up. */
export const ensure_cli_on_path = async (log: (line: string) => void): Promise<void> => {
    const bin_dir = `${home_dir()}/.julia/bin`
    try {
        const has_shim = [...Deno.readDirSync(bin_dir)].some((e) => e.name === "spacestation" || e.name.startsWith("spacestation."))
        if (!has_shim) return
    } catch {
        return // no shims installed — nothing to expose
    }
    if (Deno.build.os === "windows") {
        try {
            const script =
                "$bin = Join-Path $env:USERPROFILE '.julia\\bin'; " +
                "$cur = [Environment]::GetEnvironmentVariable('Path','User'); if ($null -eq $cur) { $cur = '' }; " +
                "if (-not (($cur -split ';') -contains $bin)) { [Environment]::SetEnvironmentVariable('Path', ($cur.TrimEnd(';') + ';' + $bin), 'User'); Write-Output 'added' }"
            const out = await new Deno.Command("powershell", { args: ["-NoProfile", "-Command", script], stdout: "piped", stderr: "null" }).output()
            if (new TextDecoder().decode(out.stdout).includes("added")) {
                log("added ~/.julia/bin to your PATH — open a new terminal to use the `spacestation` command")
            }
        } catch {
            // best-effort: the CLI still works via its full path
        }
        return
    }
    const line = 'export PATH="$HOME/.julia/bin:$PATH" # SpaceStation: the `spacestation` CLI lives here'
    let added = false
    for (const rc of [`${home_dir()}/.zshrc`, `${home_dir()}/.bashrc`, `${home_dir()}/.profile`]) {
        try {
            let current = ""
            try {
                current = Deno.readTextFileSync(rc)
            } catch {
                // no such rc yet — create it with just our line
            }
            if (current.includes(".julia/bin")) continue // the user (or we) already handled this shell
            Deno.writeTextFileSync(rc, `${current}${current === "" || current.endsWith("\n") ? "" : "\n"}\n${line}\n`)
            added = true
        } catch {
            // best-effort per file
        }
    }
    if (added) log("added ~/.julia/bin to your shell PATH — open a new terminal to use the `spacestation` command")
}

/** Is a bare `julia` runnable (no juliaup)? Used for the picker's system-julia row. */
export const has_plain_julia = async (): Promise<string | null> => {
    for (const candidate of [Deno.env.get("SPACESTATION_JULIA"), "julia", "/opt/homebrew/bin/julia", "/usr/local/bin/julia"].filter((c): c is string => !!c)) {
        try {
            const out = await new Deno.Command(candidate, { args: ["--version"], stdout: "piped", stderr: "null" }).output()
            if (out.success) return new TextDecoder().decode(out.stdout).trim()
        } catch {
            // keep looking
        }
    }
    return null
}
