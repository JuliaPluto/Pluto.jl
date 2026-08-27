// SpaceStation as a desktop app: a Deno Desktop (`deno desktop`) shell that boots the Julia
// server and shows it in a native window. The startup window lands on the shell's own pages
// (served by Deno.serve): the Launch Station (pick a Julia — or install one) unless a saved
// preference skips it, then the boot splash, then the deck (tab chrome) framing SpaceStation.
//
//   deno task dev        run from this checkout (HMR)
//   deno task build      package a redistributable app (see deno.json tasks for all platforms)
//
// The Julia side sees SPACESTATION_DESKTOP=1 and serves `desktop: true` from /api/v1/config; the
// hub pages also detect the deck structurally (framed) — see land.js.

// FIRST — before anything that could construct a window. Module bodies run in import order, and on
// Windows this one has to win the race against the first WebView2 environment. See webview2.ts.
import "./webview2.ts"

import { SpaceStationServer, type BootOptions } from "./boot.ts"
import { serve_ui } from "./splash.ts"
import { extend_under_titlebar } from "./macos_titlebar.ts"
import { has_plain_julia, julia_catalog, juliaup_info, load_settings, save_settings } from "./julia.ts"

// Deno.BrowserWindow only exists inside the desktop runtime host. Fail with a hint, not a crash,
// when someone runs this with plain `deno run` (use smoke.ts for that).
const BrowserWindow = (Deno as any).BrowserWindow
if (BrowserWindow == null) {
    console.error("Deno.BrowserWindow is unavailable — run with `deno task dev` (deno desktop), not `deno run`. For a headless check use smoke.ts.")
    Deno.exit(1)
}

// The first construction adopts the implicit startup window. On macOS the FFI tweak then extends
// the content under the title bar, so the deck's tab strip shares the traffic lights' row.
const win = new BrowserWindow({ title: "", width: 1280, height: 878, transparentTitlebar: true })
const under_titlebar = extend_under_titlebar()

const shell_port = Deno.env.get("DENO_SERVE_ADDRESS")?.split(":").pop()
const shell_url = (path: string) => `http://127.0.0.1:${shell_port}${path}`

// OS-standard menu roles ONLY — no app-specific shortcuts (that design is deliberately deferred;
// anything Pluto ships itself works inside the webview untouched). The Edit roles are required
// plumbing: macOS routes Cmd+C/V through the menu, so without them clipboard shortcuts never
// reach the webview. "Julia Version…" is a plain menu item (no accelerator): it reopens the
// Launch Station to switch versions (which restarts the server).
try {
    win.setApplicationMenu([
        {
            submenu: {
                label: "SpaceStation",
                items: [{ item: { label: "Julia Version…", id: "julia-version", enabled: true } }, "separator", { role: { role: "quit" } }],
            },
        },
        {
            submenu: {
                label: "Edit",
                items: [
                    { role: { role: "undo" } },
                    { role: { role: "redo" } },
                    "separator",
                    { role: { role: "cut" } },
                    { role: { role: "copy" } },
                    { role: { role: "paste" } },
                    { role: { role: "selectAll" } },
                ],
            },
        },
        { submenu: { label: "Window", items: [{ role: { role: "minimize" } }] } },
    ])
} catch (e) {
    console.warn("could not install the application menu:", e)
}
win.addEventListener("menuclick", (e: any) => {
    if (e.detail?.id === "julia-version") win.navigate(shell_url("/launch?change=1"))
})

// The server object is replaced when the user switches Julia versions; everything reaches it
// through these closures so the swap is invisible to the UI server and the window.
let server = new SpaceStationServer()
const wire = () => {
    server.onchange = () => {
        if (server.state.phase === "ready" && server.state.url != null) {
            win.navigate(shell_url(under_titlebar ? "/deck?inset=1" : "/deck"))
        }
        // On a post-ready crash the splash shows the error and log tail instead of a dead page.
        if (server.state.phase === "error" && server.state.url != null) {
            win.navigate(shell_url("/"))
            server.state.url = null
        }
    }
}
wire()

// Proof of life for the window. The runtime navigates the startup window to this server as soon as
// it is listening, so a healthy webview fetches a page within seconds. If nothing ever arrives, the
// window never came up — and because Deno.serve pins the event loop, the process would otherwise sit
// there forever: alive, invisible, and unkillable except through Task Manager. That is exactly what
// issue #55 looked like, five stacked copies deep. Fail loudly instead.
const WINDOW_WATCHDOG_MS = 60_000
const watchdog = setTimeout(() => {
    console.error(
        `no window after ${WINDOW_WATCHDOG_MS / 1000}s — the webview never loaded a page.\n` +
            (Deno.build.os === "windows"
                ? `WEBVIEW2_USER_DATA_FOLDER=${Deno.env.get("WEBVIEW2_USER_DATA_FOLDER") ?? "(unset)"}\n` +
                  `If WebView2 could not create its profile there, that is https://github.com/GroupTherapyOrg/SpaceStation.jl/issues/55.\n`
                : "") +
            `Exiting rather than running on with no user interface.`
    )
    Deno.exit(1)
}, WINDOW_WATCHDOG_MS)

serve_ui({
    on_first_request: () => clearTimeout(watchdog),
    state: () => server.state,
    julia_info: async () => ({
        juliaup: juliaup_info(),
        plain_julia: await has_plain_julia(),
        settings: load_settings().julia ?? { channel: null, ask: true },
        catalog: await julia_catalog(),
    }),
    on_launch: async (opts: BootOptions & { remember?: boolean }) => {
        // Remember the pick either way (it preselects next time); `remember` is the VS Code-style
        // "don't ask again" — with it set, future launches boot straight into this channel.
        save_settings({ julia: { channel: opts.channel ?? opts.add_channel ?? null, ask: !opts.remember } })
        if (server.state.phase !== "idle") {
            await server.stop()
            server = new SpaceStationServer()
            wire()
        }
        // Fire and return: start() leaves "idle" synchronously, so the page's redirect to "/"
        // lands on the live splash; progress (installs included) streams there.
        void server.start({ channel: opts.channel, add_channel: opts.add_channel, update: opts.update, bootstrap: opts.bootstrap })
    },
})

let closing = false
const shutdown = async () => {
    if (closing) return
    closing = true
    await server.stop()
    Deno.exit(0)
}
win.addEventListener("close", () => void shutdown())
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    try {
        Deno.addSignalListener(signal, () => void shutdown())
    } catch {
        // not all signals exist on all platforms (Windows has no SIGTERM listener)
    }
}

// A saved "don't ask" preference boots straight in; otherwise the window stays on the Launch
// Station (the runtime navigates it to "/" once the UI server is listening).
const pref = load_settings().julia
if (pref != null && pref.ask === false) {
    await server.start({ channel: pref.channel })
}
