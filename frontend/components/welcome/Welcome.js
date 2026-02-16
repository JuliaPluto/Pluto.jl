import _ from "../../imports/lodash.js"
import { html, useEffect, useState, useRef } from "../../imports/Preact.js"
import * as preact from "../../imports/Preact.js"

import { create_pluto_connection, ws_address_from_base } from "../../common/PlutoConnection.js"
import { new_update_message } from "../../common/NewUpdateMessage.js"
import { Open } from "./Open.js"
import { Recent } from "./Recent.js"
import { Featured } from "./Featured.js"
import { get_environment } from "../../common/Environment.js"
import default_featured_sources from "../../featured_sources.js"
import { t, th } from "../../common/lang.js"
import { add_block_screen_text_listener } from "../DesktopInterface.js"

// This is imported asynchronously - uncomment for development
// import environment from "../../common/Environment.js"

/**
 * @typedef NotebookListEntry
 * @type {{
 *  notebook_id: string,
 *  path: string,
 *  in_temp_dir: boolean,
 *  shortpath: string,
 *  process_status: string,
 * }}
 */

/**
 * @typedef LaunchParameters
 * @type {{
 * pluto_server_url: string?,
 * featured_direct_html_links: boolean,
 * featured_sources: import("./Featured.js").FeaturedSource[]?,
 * featured_source_url?: string,
 * featured_source_integrity?: string,
 * }}
 */

// We use a link from the head instead of directing linking "img/logo.svg" because parcel does not bundle preact files
const url_logo_big = document.head.querySelector("link[rel='pluto-logo-big']")?.getAttribute("href") ?? ""

/**
 * @param {{
 * launch_params: LaunchParameters,
 * }} props
 */
export const Welcome = ({ launch_params }) => {
    const [remote_notebooks, set_remote_notebooks] = useState(/** @type {Array<NotebookListEntry>} */ ([]))

    const [connected, set_connected] = useState(false)
    const [extended_components, set_extended_components] = useState({
        show_samples: true,
        CustomPicker: null,
        CustomRecent: null,
    })

    const client_ref = useRef(/** @type {import('../../common/PlutoConnection').PlutoConnection} */ ({}))

    useEffect(() => {
        const on_update = ({ message, type }) => {
            if (type === "notebook_list") {
                // a notebook list updates happened while the welcome screen is open, because a notebook started running for example
                set_remote_notebooks(message.notebooks)
            }
        }

        const on_connection_status = set_connected

        const client_promise = create_pluto_connection({
            on_unrequested_update: on_update,
            on_connection_status: on_connection_status,
            on_reconnect: async () => true,
            ws_address: launch_params.pluto_server_url ? ws_address_from_base(launch_params.pluto_server_url) : undefined,
        })
        client_promise.then(async (client) => {
            Object.assign(client_ref.current, client)
            set_connected(true)

            try {
                const environment = await get_environment(client)
                const { custom_recent, custom_filepicker, show_samples = true } = environment({ client, editor: this, imports: { preact } })
                set_extended_components((old) => ({
                    ...old,
                    CustomRecent: custom_recent,
                    CustomPicker: custom_filepicker,
                    show_samples,
                }))
            } catch (e) {}

            new_update_message(client)

            // to start JIT'ting
            client.send("current_time")
            client.send("completepath", { query: "" }, {})
        })
    }, [])

    useEffect(() => {
        add_block_screen_text_listener((/** @type string */ block_screen_text) => {
            set_block_screen_with_this_text(block_screen_text)
        })
    }, [])

    const { show_samples, CustomRecent, CustomPicker } = extended_components

    // When block_screen_with_this_text is null (default), all is fine. When it is a string, we show a big banner with that text, and disable all other UI. https://github.com/fonsp/Pluto.jl/pull/2292
    const [block_screen_with_this_text, set_block_screen_with_this_text] = useState(/** @type {string?} */ (null))
    const on_start_navigation = (value, expect_navigation = true) => {
        if (expect_navigation) {
            // Instead of calling set_block_screen_with_this_text(value) directly, we wait for the beforeunload to happen, and then we do it. If this event does not happen within 1 second, then that means that the user right-clicked, or Ctrl+Clicked (to open in a new tab), and we don't want to clear the main menu. https://github.com/fonsp/Pluto.jl/issues/2301
            const handler = (e) => {
                set_block_screen_with_this_text(value)
            }
            window.addEventListener("beforeunload", handler)
            setTimeout(() => window.removeEventListener("beforeunload", handler), 1000)
        } else {
            set_block_screen_with_this_text(value)
        }
    }

    /**
     * These are the sources from which we will download the featured notebook titles and metadata.
     * @type {import("./Featured.js").FeaturedSource[]}
     */
    const featured_sources = preact.useMemo(
        () =>
            // Option 1: configured directly
            launch_params.featured_sources ??
            // Option 2: configured through url and integrity strings
            (launch_params.featured_source_url
                ? [{ url: launch_params.featured_source_url, integrity: launch_params.featured_source_integrity }]
                : // Option 3: default
                  default_featured_sources.sources),
        [launch_params]
    )

    if (block_screen_with_this_text != null) {
        return html`
            <div class="navigating-away-banner">
                <h2>${th("t_loading_something", { text: block_screen_with_this_text })}</h2>
            </div>
        `
    }

    // Changing this?
    // Then also update index.html and the generate_index_html function.
    return html`
        <section id="title">
            <h1>${th("t_welcome_to_pluto", { pluto: html`<img src=${url_logo_big} />` })}</h1>
        </section>
        <section id="mywork">
            <div>
                <${Recent}
                    client=${client_ref.current}
                    connected=${connected}
                    remote_notebooks=${remote_notebooks}
                    CustomRecent=${CustomRecent}
                    on_start_navigation=${on_start_navigation}
                />
            </div>
        </section>
        <section id="open">
            <div>
                <${Open}
                    client=${client_ref.current}
                    connected=${connected}
                    CustomPicker=${CustomPicker}
                    show_samples=${show_samples}
                    on_start_navigation=${on_start_navigation}
                />
            </div>
        </section>
        <section id="featured">
            <div>
                <${Featured} sources=${featured_sources} direct_html_links=${launch_params.featured_direct_html_links} />
            </div>
        </section>
    `
}
