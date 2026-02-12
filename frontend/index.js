import { html, render } from "./imports/Preact.js"
import "./common/NodejsCompatibilityPolyfill.js"

import { Welcome } from "./components/welcome/Welcome.js"
import { getCurrentLanguage, getWritingDirection } from "./common/lang.js"

const url_params = new URLSearchParams(window.location.search)

/**
 *
 * @type {import("./components/welcome/Welcome.js").LaunchParameters}
 */
const launch_params = {
    //@ts-ignore
    featured_direct_html_links: !!(url_params.get("featured_direct_html_links") ?? window.pluto_featured_direct_html_links),

    //@ts-ignore
    featured_sources: window.pluto_featured_sources,

    // Setting the featured_sources object is preferred, but you can also specify a single featured source using the URL (and integrity), which also supports being set as a URL parameter.

    //@ts-ignore
    featured_source_url: url_params.get("featured_source_url") ?? window.pluto_featured_source_url,
    //@ts-ignore
    featured_source_integrity: url_params.get("featured_source_integrity") ?? window.pluto_featured_source_integrity,

    //@ts-ignore
    pluto_server_url: url_params.get("pluto_server_url") ?? window.pluto_server_url,
}

console.log("Launch parameters: ", launch_params)

document.documentElement.lang = getCurrentLanguage()
document.documentElement.dir = getWritingDirection()

// @ts-ignore
render(html`<${Welcome} launch_params=${launch_params} />`, document.querySelector("#app"))
