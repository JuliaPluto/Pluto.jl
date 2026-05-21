# `frontend/imports/`

Every third-party browser dependency that the Pluto frontend uses is wrapped here in a tiny ES-module file. The rest of the frontend imports **only** from this folder — no CDN URL appears anywhere else in `frontend/`. That way:

- there is exactly one place to update a version,
- the bundler in `frontend-bundler/` sees a single canonical URL per dependency and can fetch + inline it,
- we can add small shims (e.g. `setAutoFreeze(false)` for immer, `registerLanguage` for highlight.js) right next to the import.

In dev the browser loads these files directly and the CDN URLs resolve over the network. In a release build the bundler (Parcel + `parcel-resolver-like-a-browser`) follows the URLs and inlines everything into `frontend-dist/`.

## Anatomy of one dependency

For most deps there are two files:

- `Foo.js` — does `import … from "https://cdn.jsdelivr.net/…/foo@X.Y.Z/…"` and re-exports what we use. Tagged `// @ts-ignore` or `// @ts-nocheck` on the CDN import line so `tsc` doesn't try to fetch types from the URL.
- `Foo.d.ts` — either hand-written types, or a one-liner like `import _ from "lodash"; export default _` that re-uses the npm package's types. The npm packages used purely for types live in `frontend/package.json` `devDependencies`; run `npm install` inside `frontend/` to populate them so your editor picks them up.

Filenames matter when the npm package name collides with our wrapper. `semver-es.js` and `lodash-es.js` are named that way on purpose — if the wrapper file were called `semver.js` or `lodash.js`, then the `.d.ts` stub would be unable to import from the real npm package:

```ts
// inside lodash.d.ts — BROKEN: TypeScript resolves "lodash" back to this very file
import _ from "lodash"
export default _
```

TypeScript's `checkJs` mode treats every included `.js` file as a module whose name is the bare filename (without extension). A file called `lodash.js` therefore *is* the `"lodash"` module as far as the type checker is concerned, and importing `"lodash"` inside `lodash.d.ts` creates a circular alias that TypeScript rejects with `TS2303: Circular definition of import alias`.

The fix is to give the wrapper a name that doesn't match the npm package — the `-es` suffix is our convention for this:

```
lodash-es.js   ← wrapper; imports from cdn.jsdelivr.net/npm/lodash@…/+esm
lodash-es.d.ts ← type stub; imports from "lodash" (@types/lodash) without any circularity
```

Keep this pattern when adding any new dep whose npm package name would collide with the wrapper filename.

## How to update a dependency

1. **Find the version.** Open the relevant `*.js` file in this folder and locate the `@X.Y.Z` in the CDN URL.
2. **Pick a new version.** Check the package's changelog/release notes — these wrappers re-export a specific surface, so a major bump can quietly break things.
3. **Edit the URL.** Bump the version in **every** URL in the file (e.g. `highlightjs.js` has three; `Preact.js` has three across `preact`, `preact/hooks`, `htm`). Keep the CDN host the same unless you have a reason to change it.
4. **Update the type stub** if needed:
   - For stubs that re-export from npm (`lodash.d.ts`, `semver-es.d.ts`), bump the matching entry in `frontend/package.json` and run `npm install` in `frontend/`.
   - For hand-written stubs (`immer.d.ts`, `msgpack-lite.d.ts`), adjust by hand if the upstream API changed.
   - For auto-generated stubs, (`DOMPurify.d.ts`, `highlightjs.d.ts`, `Preact.d.ts`), download the new types again, or use tooling to generate them.
5. **Type-check** from the repo root:
   ```bash
   cd frontend && npm install
   cd .. && tsc --noEmit --strictNullChecks false
   ```
6. **Smoke-test in dev.** Run Pluto (`julia --project=. -e 'import Pluto; Pluto.run()'`), hard-reload the browser, and exercise the feature the dep powers (open a notebook, run a cell with rich output, edit code, change locale, etc.). Cached CDN responses sit in `frontend/.parcel-cache/` — wipe it if you see stale code.
7. **Bundle-test.** From `frontend-bundler/`:
   ```bash
   rm -rf ../frontend/.parcel-cache ../frontend-dist ../frontend-dist-offline
   npm run build
   ```
   Then start Pluto again — it will serve `frontend-dist/` automatically — and re-smoke-test. Rename or delete `frontend-dist/` to go back to dev mode.
8. **Run the frontend E2E suite** (see top-level `CLAUDE.md` / `test/frontend/README`).

## CDN conventions

We mix three CDNs depending on what each package ships:

- `cdn.jsdelivr.net/npm/<pkg>@<ver>/+esm` — jsdelivr's auto-converted ESM build. Used for packages that don't ship native ESM. Sometimes needs `.default` twice (see `AnsiUp.js`).
- `cdn.jsdelivr.net/npm/<pkg>@<ver>/<file>.mjs` — when the package already publishes a working ESM entry point (`immer`).
- `cdn.jsdelivr.net/gh/<owner>/<repo>@<tag>/<file>` — for packages we publish ourselves or forks we maintain (`JuliaPluto/codemirror-pluto-setup`, `fonsp/msgpack-lite`, `highlightjs/cdn-release`). Tag must exist on GitHub.
- `esm.sh/<pkg>@<ver>?target=es2020` — esm.sh's pre-bundled ESM

## Per-file notes

- **`AnsiUp.js`** — needs `.default` twice because of how jsdelivr re-wraps the CJS module. Don't simplify without testing.
- **`CodemirrorPlutoSetup.js`** — pulls from the separate [`JuliaPluto/codemirror-pluto-setup`](https://github.com/JuliaPluto/codemirror-pluto-setup) repo, which bundles CodeMirror 6 + Pluto's extensions into one ESM file. `CodemirrorPlutoSetup.d.ts` is **generated** in that repo and copied here verbatim — don't hand-edit. To update: tag a new release there, then bump the `@2002.x.y` here and copy the new `.d.ts` from that repo's `dist/`.
- **`highlightjs.js`** — three URLs (core + julia + julia-repl). Bump all three together. Also exposes `window.hljs` for user notebooks (see PR #2244).
- **`immer.js`** — pinned export shape is load-bearing: the `immer` default export is actually `produce`, kept that way for backwards compat (PR #3372). `setAutoFreeze(false)` is required for mixed mutable/immutable `setState` paths.
- **`lang_imports.js`** — not a CDN dep. It just bulk-imports the JSON files in `frontend/lang/` with import attributes (`with { type: "json" }`). Separate file because Prettier can't parse `with`. When you add a new locale, add it here and to `frontend/lang/lang.js`.
- **`lodash.js` / `semver-es.js`** — `.d.ts` re-exports the npm package's own types; keep `frontend/package.json` `devDependencies` in sync so editor tooltips work.
- **`Preact.js`** — three coordinated imports (`preact`, `preact/hooks`, `htm`) all pinned via `pin=v113&target=es2020`. Bumping preact usually means bumping all three URLs and possibly the pin.
- **`PreactCustomElement.js`** — **vendored source**, not a CDN import. Copied from [preactjs/preact-custom-element](https://github.com/preactjs/preact-custom-element) with local modifications (e.g. the 500ms reconnect grace period in `disconnectedCallback`). To "update" it, re-diff against upstream and re-apply our changes by hand. Don't replace blindly.

## Adding a new dependency

1. Create `Foo.js` here that imports from a pinned CDN URL and re-exports the surface you actually use (don't `export *` unless you really mean it — narrower is better for tree-shaking).
2. Add `Foo.d.ts`. If the npm package has good types, the two-line `import * as Foo from "foo"; export default Foo` stub plus a `devDependencies` entry in `frontend/package.json` is the cheapest option.
3. Import `Foo` only from `./imports/Foo.js` elsewhere in `frontend/`. Never reach for the CDN URL directly outside this folder.
4. Run the type-check, dev smoke-test, and bundler build from the update flow above.
