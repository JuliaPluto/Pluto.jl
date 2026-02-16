import _ from "../../imports/lodash.js"
import { html, useEffect, useState } from "../../imports/Preact.js"
import register from "../../imports/PreactCustomElement.js"
import { FeaturedCard } from "./FeaturedCard.js"
import { t, th } from "../../common/lang.js"

/**
 * @typedef SourceManifestNotebookEntry
 * @type {{
 *   id: String,
 *   hash: String,
 *   html_path?: String,
 *   statefile_path?: String,
 *   notebookfile_path?: String,
 *   frontmatter?: Record<string,any>,
 * }}
 */

/**
 * @typedef SourceManifestCollectionEntry
 * @type {{
 *   title?: String,
 *   description?: String,
 *   tags?: Array<String> | "everything",
 * }}
 */

/**
 * @typedef SourceManifest
 * @type {{
 *   notebooks: Record<string,SourceManifestNotebookEntry>,
 *   collections?: Array<SourceManifestCollectionEntry>,
 *   pluto_version?: String,
 *   julia_version?: String,
 *   format_version?: String,
 *   source_url?: String,
 *   title?: String,
 *   description?: String,
 *   binder_url?: String,
 *   slider_server_url?: String,
 * }}
 */

/**
 * This data is used as placeholder while the real data is loading from the network.
 * @returns {SourceManifest[]}
 */
const placeholder_data = () => [
    {
        title: t("t_featured_notebooks_title"),
        description: t("t_featured_notebooks_description"),
        collections: [
            {
                title: t("t_loading_ellipses"),
                tags: [],
            },
        ],
        notebooks: {},
    },
]

/** This HTML is shown instead of the featured notebooks if the user is offline. */
const offline_html = () => html`
    <div class="featured-source">
        <h1>${t("t_featured_notebooks_title")}</h1>
        <p>${t("t_featured_offline_intro")}</p>
        <ul>
            <li>1. <a href="sample/Getting%20started.jl">${t("t_featured_getting_started")}</a></li>
            <li>2. <a href="sample/Markdown.jl">${t("t_featured_markdown")}</a></li>
            <li>3. <a href="sample/Basic%20mathematics.jl">${t("t_featured_basic_mathematics")}</a></li>
            <li>4. <a href="sample/Interactivity.jl">${t("t_featured_interactivity")}</a></li>
            <li>5. <a href="sample/PlutoUI.jl.jl">PlutoUI.jl</a></li>
            <li>6. <a href="sample/Plots.jl.jl">Plots.jl</a></li>
            <li>7. <a href="sample/Tower%20of%20Hanoi.jl">${t("t_featured_tower_of_hanoi")}</a></li>
            <li>8. <a href="sample/JavaScript.jl">${t("t_featured_javascript")}</a></li>
        </ul>
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <p>${th("t_featured_offline_tip")}</p>
    </div>
`

/**
 * If no collections are defined, then this special collection will just show all notebooks under the "Notebooks" category.
 * No collections are defined if no `pluto_export_configuration.json` file was provided to PlutoSliderServer.jl.
 * @type {SourceManifestCollectionEntry[]}
 */
const fallback_collections = [
    {
        title: "Notebooks",
        tags: "everything",
    },
]

/**
 * @typedef FeaturedSource
 * @type {{
 *  url: String,
 *  id?: String,
 *  integrity?: String,
 *  valid_until?: String
 * }}
 */

const get_id = (/** @type {FeaturedSource} */ source) => source?.id ?? source.url

/**
 * @param {{
 * sources: FeaturedSource[]?,
 * direct_html_links: boolean,
 * }} props
 */
export const Featured = ({ sources, direct_html_links }) => {
    const placeholders = placeholder_data()
    const fallbackCollections = [
        {
            title: t("t_notebooks"),
            tags: "everything",
        },
    ]

    // source_data will be a mapping from [source URL] => [data from that source]
    const [source_data, set_source_data] = useState(/** @type {Record<String,SourceManifest>} */ ({}))

    useEffect(() => {
        if (sources != null) {
            set_waited_too_long(false)
            set_source_data({})

            const ids = Array.from(new Set(sources.map(get_id)))

            const promises = ids.map((id) => {
                const sources_for_id = sources.filter((source) => get_id(source) === id)

                let result = promise_any_with_priority(
                    sources_for_id.map(async (source) => {
                        const { url, integrity, valid_until } = source

                        if (valid_until != null && new Date(valid_until) < new Date()) {
                            throw new Error(`Source ${url} is expired with valid_until ${valid_until}`)
                        }

                        const data = await (await fetch(new Request(url, { integrity: integrity ?? undefined }))).json()

                        if (data.format_version !== "1") {
                            throw new Error(`Invalid format version: ${data.format_version}`)
                        }

                        return [data, id, url]
                    })
                )

                return result.then(([data, id, url]) => {
                    set_source_data((old) => ({
                        ...old,
                        [id]: {
                            ...data,
                            source_url: url,
                        },
                    }))
                })
            })

            Promise.any(promises).catch((e) => {
                console.error("All featured sources failed to load: ", e)
                ;(e?.errors ?? []).forEach((e) => console.error(e))
                set_waited_too_long(true)
            })
        }
    }, [sources])

    useEffect(() => {
        if (Object.entries(source_data).length > 0) {
            console.log("Sources:", source_data)
        }
    }, [source_data])

    const [waited_too_long, set_waited_too_long] = useState(false)
    useEffect(() => {
        setTimeout(() => {
            set_waited_too_long(true)
        }, 8 * 1000)
    }, [])

    const no_data = Object.entries(source_data).length === 0

    const ids = Array.from(new Set(sources?.map(get_id) ?? []))

    const sorted_on_source_order = ids.map((id) => source_data[id]).filter((d) => d != null)

    return no_data && waited_too_long
        ? offline_html()
        : html`
              ${(no_data ? placeholders : sorted_on_source_order).map((/** @type {SourceManifest} */ data) => {
                  let collections = data?.collections ?? fallbackCollections

                  return html`
                      <div class="featured-source">
                          <h1>${data.title}</h1>
                          <p>${data.description}</p>
                          ${collections.map((coll) => {
                              return html`
                                  <div class="collection">
                                      <h2>${coll.title}</h2>
                                      <p>${coll.description}</p>
                                      <div class="card-list">
                                          ${collection(Object.values(data.notebooks), coll.tags ?? []).map(
                                              (entry) => html`<${FeaturedCard} entry=${entry} source_manifest=${data} direct_html_links=${direct_html_links} />`
                                          )}
                                      </div>
                                  </div>
                              `
                          })}
                      </div>
                  `
              })}
          `
}

register(Featured, "pluto-featured", ["sources", "direct_html_links"])

/** Return all notebook entries that have at least one of the given `tags`. Notebooks are sorted on `notebook.frontmatter.order` or `notebook.id`. */
const collection = (/** @type {SourceManifestNotebookEntry[]} */ notebooks, /** @type {String[] | "everything"} */ tags) => {
    const nbs = tags === "everything" ? notebooks : notebooks.filter((notebook) => tags.some((t) => (notebook.frontmatter?.tags ?? []).includes(t)))

    let n = (s) => (isNaN(s) ? s : Number(s))
    return /** @type {SourceManifestNotebookEntry[]} */ (_.sortBy(nbs, [(nb) => n(nb?.frontmatter?.order), "id"]))
}

/**
 * Given a list promises, return promise[0].catch(() => promise[1].catch(() => promise[2]... etc))
 * @param {Promise[]} promises
 * @returns {Promise}
 */
const promise_any_with_priority = (/** @type {Promise[]} */ promises, /** @type {Promise[]} */ already_rejected = []) => {
    if (promises.length <= 1) {
        return Promise.any([...promises, ...already_rejected])
    } else {
        return promises[0].catch(() => promise_any_with_priority(promises.slice(1), [...already_rejected, promises[0]]))
    }
}
