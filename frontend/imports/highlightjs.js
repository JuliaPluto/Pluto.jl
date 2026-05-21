// @ts-ignore
import hljs from "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/highlight.min.js"
// @ts-ignore
import hljs_julia from "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/languages/julia.min.js"
// @ts-ignore
import hljs_juliarepl from "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/languages/julia-repl.min.js"

hljs.registerLanguage("julia", hljs_julia)
hljs.registerLanguage("julia-repl", hljs_juliarepl)

// Attach the highlighter object to the window to allow custom highlighting from the frontend. See https://github.com/fonsp/Pluto.jl/pull/2244
//@ts-ignore
window.hljs = hljs

export default hljs
