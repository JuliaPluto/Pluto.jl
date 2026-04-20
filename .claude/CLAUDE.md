# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Pluto.jl is a reactive Julia notebook: a Julia web server that executes notebook code in isolated worker processes and pushes state diffs to a browser frontend (pure ES modules, no build step in dev). There are three cooperating layers, plus a bundler that packages the frontend for release.

## Repository layout (big picture)

- **`src/`** — the Julia server. `src/Pluto.jl` is the entry point and orders the `include`s; read it to understand module dependencies.
  - `src/notebook/` — the notebook file format (`Cell`, `Notebook`, saving/loading the `.jl` format that `sample/` demonstrates).
  - `src/analysis/` — static code analysis (`Parse.jl`, `DependencyCache.jl`, `MoreAnalysis.jl`). Uses `ExpressionExplorer` + `PlutoDependencyExplorer` to build the reactive dependency graph *without executing code*.
  - `src/evaluation/` — runs cells in the correct topological order. `WorkspaceManager.jl` manages worker processes (via `Malt`); `Run.jl` / `RunBonds.jl` drive reactive re-execution; `MacroAnalysis.jl` handles the round-trip needed to expand macros in the worker before analyzing them.
  - `src/runner/PlutoRunner/` — code that runs **inside the worker process**. It is a separate sub-package loaded into each worker; it formats outputs, captures logs, evaluates cells, and communicates via `MsgPack`. Keep its dependencies minimal — anything it imports pollutes the user's notebook namespace.
  - `src/packages/` — per-notebook package environments (Pluto's built-in Pkg manager). `PkgCompat.jl` wraps Pkg internals; `Packages.jl` is the reactive integration.
  - `src/webserver/` — HTTP + WebSocket server. `Dynamic.jl` is the main RPC surface (the "update" protocol the frontend talks to); `Firebasey.jl` / `FirebaseyUtils.jl` implement JSON-patch-like diffing used to sync notebook state; `SessionActions.jl` is the high-level API (open, shutdown, move); `Static.jl` serves the frontend files.

- **`frontend/`** — plain ES modules, run directly in the browser during development (no bundler needed). Preact + HTM (`frontend/imports/Preact.js`) for UI, CodeMirror 6 in `components/CellInput/`. `editor.js` is the notebook UI entry; `index.js` is the welcome/launcher. `common/PlutoConnection.js` is the WebSocket client that talks to `src/webserver/Dynamic.jl`.

- **`frontend-bundler/`** — Parcel-based bundler with a custom `parcel-resolver-like-a-browser` resolver that is *intentionally restrictive*: it only resolves imports the same way a browser would, so nothing can accidentally work in the bundle that wouldn't work in dev. Output goes to `frontend-dist/` (loaded instead of `frontend/` when present; see `FRONTEND_DIST_DIR` in `src/Pluto.jl`).

- **`test/`** — Julia backend tests plus a separate Node/Jest+Puppeteer E2E suite in `test/frontend/`.

- **`sample/`** — example notebooks that double as test fixtures (they are real Pluto notebook files).

## Commands

### Running Pluto locally (dev)
```julia
julia --project=. -e 'import Pkg; Pkg.instantiate()'
julia --project=. -e 'import Pluto; Pluto.run()'
```
The server serves `frontend/` directly — edits to JS/CSS need only a browser reload. With `frontend-dist/` present (e.g. after a bundler run), the server serves that instead; delete or rename it to go back to dev mode.

### Backend tests (Julia)
```bash
julia --project=. -e 'import Pkg; Pkg.test()'
```
To run a single file, edit `test/runtests.jl` (the file has a comment at the top explaining this) and comment out every `@timeit_include` line except `helpers.jl` and the one you want. The in-file `Revise` snippet near the top is the fast iteration path.

- Env var `PLUTO_TEST_ONLY_COMPILETIMES=true` runs only `compiletimes.jl` and exits.
- Many tests spawn worker processes; `verify_no_running_processes()` is called between test files — don't reorder without understanding this.

### Frontend E2E tests (`test/frontend/`, run from that directory)
```bash
npm install
# in another terminal, start Pluto on a known port:
PLUTO_PORT=2345 julia --project=/path/to/Pluto -e \
  'import Pluto; Pluto.run(port=2345, require_secret_for_access=false, launch_browser=false)'
# then:
PLUTO_PORT=2345 npm run test                                    # headless
HEADLESS=false PLUTO_PORT=2345 npm run test                     # watch the browser
HEADLESS=false PLUTO_PORT=2345 npm run test -- -t="suite name"  # one suite
```
**To fail a test on a handled-but-bad situation**, log with `console.error("PlutoError ...")` — the runner treats any `PlutoError` string in console output as a failure.

### TypeScript check (matches CI `TypeScriptCheck.yml`)
```bash
cd frontend && npm install
tsc --noEmit --strictNullChecks false   # from repo root
```
`tsconfig.json` has `allowJs` + `checkJs` — the frontend is plain JS with JSDoc type annotations, checked as TS.

### Bundler
```bash
cd frontend-bundler
npm install
rm -rf ../frontend/.parcel-cache ../frontend-dist ../frontend-dist-offline
npm run build          # online bundle → frontend-dist/
npm run build-offline  # offline bundle → frontend-dist-offline/
```
Requires Node 22.

### Formatting
Prettier config at the repo root: 160-col, 4-space, no semicolons, double quotes, ES5 trailing commas.

## Frontend conventions (from `.cursor/rules/`)

### Styling
- Put new styles in the existing CSS files (usually `frontend/editor.css`) — not inline in JS.
- New colors go as CSS variables in **both** `frontend/themes/light.css` and `frontend/themes/dark.css`. Don't reuse an existing variable with the wrong semantics.
- The same frontend serves the IDE and Print mode (PDF/HTML export). If a UI element should not appear in Print, add a rule to `frontend/hide-ui.css`.
- Prefer custom element names (`<pluto-pkg-terminal>`) as CSS selectors over generic classes.
- Avoid inline styles except for small values that genuinely change at runtime.

### Icons
- Icons are empty `<span>`s styled in CSS (background-image or `::before`), **never** imported from a JS icon library and never PNG/JPG.
- Use Ionicons pinned to `5.5.1`: `https://cdn.jsdelivr.net/gh/ionic-team/ionicons@5.5.1/src/svg/<name>.svg`.
- Size in `em`, use `background-size: contain`, theme via `filter: var(--image-filters)` (or `filter: invert(1)` for light-on-dark).

### Localization (i18next)
All user-facing strings must be localized. Always localize **complete sentences**, not fragments.
```js
import { t, th } from "../../lang/lang.js"
t("t_remove_from_recent_notebooks")              // plain text (titles, aria-labels)
th("t_newnotebook")                               // content with HTML/Preact
th("t_welcome_to_pluto", { pluto: html`<img/>`})  // with interpolation
```
- Keys always start with `t_`.
- Add every new key to `frontend/lang/english.json` (the fallback); other locales in the same folder.
- Pluralization: `t_foo` + `t_foo_one`.

## Downloading CI failure logs

Grab logs from the N most recent failed runs of a workflow (e.g. `FrontendTest.yml`) for local analysis:

```bash
# 1. List the failed runs as JSON (pick N with --limit)
gh run list --repo JuliaPluto/Pluto.jl --workflow FrontendTest.yml \
    --status failure --limit 20 \
    --json databaseId,displayTitle,createdAt,conclusion

# 2. For each databaseId, save the expanded job log
mkdir -p ci_logs_failed
for id in <id1> <id2> ...; do
    gh run view --repo JuliaPluto/Pluto.jl "$id" --log > "ci_logs_failed/${id}.log"
done
```

**Important:** use `gh run view --log`, **not** `gh run download`. `gh run download` fetches workflow *artifacts* (for `FrontendTest.yml` those are screenshot bundles), not the stdout/stderr of the jobs.

Each log is ~80–150 KB; 20 runs fit in ~2 MB. Search them with `Grep` for patterns like `FAIL __tests__`, `TimeoutError`, `AssertionError`, `ProtocolError`, or `Tests:.*failed`.
