// Julia server lifecycle for the SpaceStation desktop shell. GUI-free on purpose: main.ts wires
// this to a Deno.BrowserWindow, smoke.ts drives it from a plain `deno run` for headless testing.

import * as buildinfo from "./buildinfo.ts"
import { data_dir, ensure_cli_on_path, home_dir, juliaup_bin, vendored_bin_dir } from "./julia.ts"

export type Phase = "idle" | "installing-julia" | "finding-julia" | "installing" | "starting" | "ready" | "error"

export interface BootState {
    phase: Phase
    detail: string
    log: string[]
    url: string | null
    port: number | null
}

/** What to boot with, decided on the launch page (or by a saved preference). */
export interface BootOptions {
    channel?: string | null // juliaup channel to run (`julia +channel`)
    add_channel?: string | null // install this channel first (juliaup add), then run it
    update?: boolean // bring `channel` to its latest version first (juliaup update)
    bootstrap?: boolean // no Julia at all: install juliaup itself first
}

const LOG_LINES = 200

export class SpaceStationServer {
    state: BootState = { phase: "idle", detail: "", log: [], url: null, port: null }
    private child: Deno.ChildProcess | null = null
    private stopping = false
    onchange: (() => void) | null = null

    private set(phase: Phase, detail: string) {
        this.state.phase = phase
        this.state.detail = detail
        this.onchange?.()
    }

    private log_line(line: string) {
        if (line.trim() === "") return
        this.state.log.push(line)
        if (this.state.log.length > LOG_LINES) this.state.log.splice(0, this.state.log.length - LOG_LINES)
        // First-run `Pkg.add`/precompile is the long pole; surface it as its own phase so the
        // splash can set expectations ("minutes, once") instead of looking hung.
        if (this.state.phase === "starting" && /Installing SpaceStation|Precompiling|Updating registry/i.test(line)) {
            this.set("installing", "installing Julia packages (first run only — this can take a few minutes)")
        }
        this.onchange?.()
    }

    /** Locate a runnable `julia`. A compiled .app launched from Finder has a minimal PATH, so the
     *  well-known install locations are checked explicitly, juliaup first. */
    async find_julia(): Promise<string | null> {
        const home = home_dir()
        const exe = Deno.build.os === "windows" ? "julia.exe" : "julia"
        const vendored = vendored_bin_dir()
        const candidates = [
            Deno.env.get("SPACESTATION_JULIA"),
            `${home}/.juliaup/bin/${exe}`,
            // the bundle's portable julialauncher: resolves +channels against ~/.julia/juliaup
            // (only answers --version once a channel is installed, so it self-skips when empty)
            vendored == null ? null : `${vendored}/${exe}`,
            "julia", // PATH, when launched from a terminal
            "/opt/homebrew/bin/julia",
            "/usr/local/bin/julia",
        ].filter((c): c is string => !!c)
        for (const candidate of candidates) {
            try {
                const out = await new Deno.Command(candidate, { args: ["--version"], stdout: "piped", stderr: "null" }).output()
                if (out.success) {
                    this.log_line(`found ${new TextDecoder().decode(out.stdout).trim()} at ${candidate}`)
                    return candidate
                }
            } catch {
                // not here — try the next candidate
            }
        }
        return null
    }

    /** The Julia project to run. Priority: explicit override → the checkout the app was BUILT
     *  from, when it still exists on this machine (buildinfo) → the repo this file sits in (dev
     *  run) → a managed environment in the platform app-data dir (distributed app; SpaceStation is
     *  installed on first run, pinned to the built git rev when buildinfo carries one). */
    resolve_project(): { project: string; managed: boolean } {
        const override = Deno.env.get("SPACESTATION_PROJECT")
        if (override) return { project: override, managed: false }
        const is_spacestation_repo = (dir: string) => {
            try {
                return /name\s*=\s*"SpaceStation"/.test(Deno.readTextFileSync(`${dir}/Project.toml`))
            } catch {
                return false
            }
        }
        if (buildinfo.project != null && is_spacestation_repo(buildinfo.project)) {
            return { project: buildinfo.project, managed: false }
        }
        try {
            const here = import.meta.dirname // OS-native; URL .pathname breaks on Windows drive letters
            if (here != null && is_spacestation_repo(`${here}/..`)) return { project: `${here}/..`, managed: false }
        } catch {
            // not running from a source checkout — fall through to the managed environment
        }
        return { project: `${data_dir()}/julia-env`, managed: true }
    }

    /** Run a command with stdout+stderr streaming into the boot log; true on exit 0. */
    private async run_logged(cmd: string, args: string[]): Promise<boolean> {
        try {
            const child = new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).spawn()
            this.pipe(child.stdout)
            this.pipe(child.stderr)
            return (await child.status).success
        } catch (e) {
            this.log_line(`${cmd} failed: ${e}`)
            return false
        }
    }

    /** Ask the OS for a free port. (Tiny race between close and Julia binding it — acceptable.) */
    pick_port(): number {
        const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 })
        const port = (listener.addr as Deno.NetAddr).port
        listener.close()
        return port
    }

    /** SpaceStation writes a connection file per server (port + access secret) exactly so external
     *  tools can find it — flat JSON in the state dir, keyed `<node>-<port>.json`. */
    read_secret(port: number): string | null {
        const home = home_dir()
        const dir = `${Deno.env.get("XDG_STATE_HOME") ?? `${home}/.local/state`}/pluto/servers`
        try {
            for (const entry of Deno.readDirSync(dir)) {
                if (!entry.name.endsWith(`-${port}.json`)) continue
                const parsed = JSON.parse(Deno.readTextFileSync(`${dir}/${entry.name}`))
                if (typeof parsed.secret === "string") return parsed.secret
            }
        } catch {
            // no registry (yet) — the caller falls back to an unauthenticated URL check
        }
        return null
    }

    async start(opts: BootOptions = {}): Promise<void> {
        this.set("finding-julia", "") // leave "idle" synchronously: the launch page hands off to the splash

        // A machine with no Julia at all: the bundle ships juliaup's portable build (static Rust,
        // no installer needed — Windows included), so this is just `juliaup add release`. The
        // official installer script remains the fallback for bundles built without vendor/.
        if (opts.bootstrap) {
            const juliaup = juliaup_bin()
            if (juliaup != null) {
                this.set("installing-julia", "installing Julia (release channel) — a few minutes, once")
                const ok = await this.run_logged(juliaup, ["add", "release"])
                if (!ok) {
                    this.set("error", "could not install Julia — see the log above, or install from https://julialang.org/downloads")
                    return
                }
            } else if (Deno.build.os === "windows") {
                this.set("error", "This build has no bundled installer — install Julia from https://julialang.org/downloads and relaunch.")
                return
            } else {
                this.set("installing-julia", "installing Julia via juliaup — a few minutes, once")
                const ok = await this.run_logged("sh", ["-c", "curl -fsSL https://install.julialang.org | sh -s -- --yes"])
                if (!ok) {
                    this.set("error", "the Julia installer failed — see the log above, or install from https://julialang.org/downloads")
                    return
                }
            }
        }

        // Bring an installed channel up to date before launching on it.
        if (opts.update && opts.channel) {
            this.set("installing-julia", `updating Julia ${opts.channel} (juliaup update)`)
            const juliaup = juliaup_bin() ?? `${home_dir()}/.juliaup/bin/juliaup`
            const ok = await this.run_logged(juliaup, ["update", opts.channel])
            if (!ok) {
                this.set("error", `could not update Julia channel "${opts.channel}" — see the log above`)
                return
            }
        }

        // Install a specific channel the user picked but doesn't have yet.
        if (opts.add_channel) {
            this.set("installing-julia", `installing Julia ${opts.add_channel} (juliaup add)`)
            const juliaup = juliaup_bin() ?? `${home_dir()}/.juliaup/bin/juliaup`
            const ok = await this.run_logged(juliaup, ["add", opts.add_channel])
            if (!ok) {
                this.set("error", `could not install Julia channel "${opts.add_channel}" — see the log above`)
                return
            }
        }
        const channel = opts.channel ?? opts.add_channel ?? null

        const julia = await this.find_julia()
        if (julia == null) {
            this.set(
                "error",
                "Julia was not found. Install it from https://julialang.org/downloads (juliaup is recommended), or set SPACESTATION_JULIA to the julia binary."
            )
            return
        }
        const { project, managed } = this.resolve_project()
        const port = this.pick_port()
        this.state.port = port
        // `julia +channel` is juliaup's version selector — it only means something to the shim
        // (the user's ~/.juliaup launcher, or our vendored portable one).
        const use_channel = channel != null && (julia.includes(".juliaup") || julia.includes("juliaup-portable"))
        if (use_channel) this.log_line(`using Julia channel ${channel}`)
        const via = use_channel ? ` (Julia ${channel})` : ""
        this.set("starting", managed ? `starting SpaceStation${via} (managed environment)` : `starting SpaceStation${via} from ${project}`)

        // One -e script per mode. A managed env installs SpaceStation on first run — pinned to the
        // git rev the app was built from when buildinfo carries one (so a branch build runs that
        // branch, not the last registry release), the registry otherwise. A marker file records
        // what's installed, so a rebuilt app upgrades a stale env instead of trusting `import`.
        const want = buildinfo.source ? `${buildinfo.source.url}#${buildinfo.source.rev}` : "registry"
        const spec = buildinfo.source ? `url=${JSON.stringify(buildinfo.source.url)}, rev=${JSON.stringify(buildinfo.source.rev)}` : `"SpaceStation"`
        const boot = managed
            ? `import Pkg; env = ENV["SPACESTATION_DESKTOP_ENV"]; Pkg.activate(env);
               marker = joinpath(env, ".spacestation-source"); want = ${JSON.stringify(want)};
               if !isfile(marker) || read(marker, String) != want
                   println("Installing SpaceStation ($(want))..."); flush(stdout);
                   Pkg.add(${spec});
                   # the desktop also registers the CLI (Project.toml [apps]): a real
                   # \`spacestation\` on ~/.julia/bin, usable from any terminal. Best-effort —
                   # the app itself never depends on it.
                   try
                       Pkg.Apps.add(${spec})
                       println("installed the spacestation CLI (add ~/.julia/bin to PATH to use it anywhere)")
                   catch e
                       println("CLI install skipped: ", sprint(showerror, e))
                   end;
                   write(marker, want)
               end;
               import SpaceStation; SpaceStation.run(port=${port}, launch_browser=false)`
            : `import SpaceStation; SpaceStation.run(port=${port}, launch_browser=false)`
        const args = managed ? ["--startup-file=no", "-e", boot] : [`--project=${project}`, "--startup-file=no", "-e", boot]
        if (use_channel) args.unshift(`+${channel}`)
        if (managed) Deno.mkdirSync(project, { recursive: true })

        const child = new Deno.Command(julia, {
            args,
            env: {
                // the hub reads this via /api/v1/config: one webview window, so open workspaces
                // in-place instead of spawning browser tabs
                SPACESTATION_DESKTOP: "1",
                ...(managed ? { SPACESTATION_DESKTOP_ENV: project } : {}),
            },
            stdout: "piped",
            stderr: "piped",
        }).spawn()
        this.child = child
        this.pipe(child.stdout)
        this.pipe(child.stderr)
        child.status.then((status) => {
            this.child = null
            if (!this.stopping) this.set("error", `the SpaceStation server exited unexpectedly (code ${status.code})`)
        })

        // Readiness = /ping answers. First run can legitimately take minutes (Pkg + precompile).
        const deadline = Date.now() + 15 * 60 * 1000
        while (Date.now() < deadline) {
            if (this.child == null) return // exited; phase already set to error above
            try {
                const res = await fetch(`http://127.0.0.1:${port}/ping`, { signal: AbortSignal.timeout(1000) })
                await res.body?.cancel()
                if (res.ok) {
                    const secret = this.read_secret(port)
                    // ?desktop=1 tells the hub SYNCHRONOUSLY that it's inside the desktop shell
                    // (the server env flag arrives too, but only after an async config fetch)
                    this.state.url = `http://127.0.0.1:${port}/?${secret ? `secret=${secret}&` : ""}desktop=1`
                    this.set("ready", "")
                    // downloaded-app installs registered the `spacestation` CLI — make sure the
                    // user's shells can actually find it (idempotent, best-effort)
                    if (managed) void ensure_cli_on_path((line) => this.log_line(line))
                    return
                }
            } catch {
                // not up yet
            }
            await new Promise((r) => setTimeout(r, 500))
        }
        this.set("error", "timed out waiting for the SpaceStation server to start")
        this.stop()
    }

    private async pipe(stream: ReadableStream<Uint8Array>) {
        const decoder = new TextDecoder()
        let buffer = ""
        try {
            for await (const chunk of stream) {
                buffer += decoder.decode(chunk, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() ?? ""
                for (const line of lines) this.log_line(line)
            }
        } catch {
            // stream closed with the process
        }
        if (buffer.trim() !== "") this.log_line(buffer)
    }

    /** Graceful shutdown: SIGTERM lets the server reap terminals, tunnels, and child workspace
     *  servers (its on_shutdown handler); escalate only if it lingers. */
    async stop(): Promise<void> {
        const child = this.child
        if (child == null) return
        this.stopping = true
        try {
            child.kill("SIGTERM")
        } catch {
            return
        }
        const killed = await Promise.race([child.status.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 5000))])
        if (!killed) {
            try {
                child.kill("SIGKILL")
            } catch {
                // already gone
            }
        }
    }
}
