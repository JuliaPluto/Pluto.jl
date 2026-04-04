import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-node-polyfills";
import { copy } from "@web/rollup-plugin-copy";

const external = [
  "react",
  "react-dom",
  "https://esm.sh/preact@10.13.2?pin=v113&target=es2020",
  "https://esm.sh/preact@10.13.2/hooks?pin=v113&target=es2020",
  "https://esm.sh/htm@3.1.1?pin=v113&target=es2020",
  "https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/+esm",
  "https://cdn.jsdelivr.net/gh/JuliaPluto/codemirror-pluto-setup@2001.0.0/dist/index.es.min.js",
  "https://esm.sh/dompurify@3.2.3?pin=v135",
  "https://cdn.jsdelivr.net/npm/ansi_up@5.1.0/+esm",
  "https://cdn.jsdelivr.net/npm/dialog-polyfill@0.5.6/dist/dialog-polyfill.esm.min.js",
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/julia-repl.min.js",
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/julia.min.js",
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js",
];

const aliasEntries = [
  {
    find: "https://cdn.jsdelivr.net/npm/@observablehq/stdlib@3.3.1/+esm",
    replacement: "@observablehq/stdlib",
  },
  {
    find: "https://cdn.jsdelivr.net/gh/fonsp/msgpack-lite@0.1.27-es.1/dist/msgpack-es.min.mjs",
    replacement: "msgpack-lite/dist/msgpack-es.min.mjs",
  },
  {
    find: "https://esm.sh/seamless-scroll-polyfill@2.1.8/lib/polyfill.js?pin=v113&target=es2020",
    replacement: "seamless-scroll-polyfill/lib/polyfill.js",
  },
  {
    find: "https://cdn.jsdelivr.net/npm/immer@10.1.3/dist/immer.mjs",
    replacement: "immer",
  },
  {
    find: "https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/+esm",
    replacement: "lodash-es",
  },
  {
    find: "https://cdn.jsdelivr.net/npm/requestidlecallback-polyfill@1.0.2/index.js",
    replacement: "requestidlecallback-polyfill",
  },
  {
    find: "https://cdn.jsdelivr.net/npm/vmsg@0.4.0/vmsg.js",
    replacement: "vmsg",
  },
  { find: "fs", replacement: "memfs" },
  { find: "path", replacement: "path-browserify" },
];

const plugins = [
  typescript(),
  nodePolyfills(),
  alias({
    entries: aliasEntries,
  }),
  resolve({
    browser: true,
    preferBuiltins: false,
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  }),
  commonjs(),
  json(),
  copy({ patterns: "standalone/integrations/node-polyfill.js" }),
  copy({ patterns: "standalone/index.d.ts" }),
  copy({ patterns: "standalone/integrations/react.d.ts" }),
  copy({ patterns: "imports/*.d.ts", rootDir: "." }),
];

export default [
  // ES Module build
  {
    input: "ui.ts",
    output: {
      file: "dist/ui.esm.js",
      format: "es",
      sourcemap: true,
    },
    external,
    plugins: [plugins.slice(0)],
  },
  // CommonJS build: parcel will do this
  {
    input: "ui.ts",
    output: {
      file: "dist/ui.js",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    external,
    plugins: [...plugins.slice(1)],
  },
  // ES Module build
  {
    input: "standalone/index.js",
    output: {
      file: "dist/index.esm.js",
      format: "es",
      sourcemap: true,
    },
    external,
    plugins,
  },
  // CommonJS build
  {
    input: "standalone/index.js",
    output: {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    external,
    plugins,
  }, // ES Module build
  {
    input: "standalone/integrations/react.js",
    output: {
      file: "dist/react.esm.js",
      format: "es",
      sourcemap: true,
    },
    external,
    plugins,
  },
  // CommonJS build
  {
    input: "standalone/integrations/react.js",
    output: {
      file: "dist/react.js",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    external,
    plugins,
  },
];
