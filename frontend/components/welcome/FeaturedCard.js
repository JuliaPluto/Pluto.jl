import { base64url_to_base64 } from "../../common/PlutoHash.js"
import { with_query_params } from "../../common/URLTools.js"
import _ from "../../imports/lodash.js"
import { html, useEffect, useState, useMemo } from "../../imports/Preact.js"

const transparent_svg = "data:image/svg+xml;charset=utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E"

const str_to_degree = (s) => ([...s].reduce((a, b) => a + b.charCodeAt(0), 0) * 79) % 360

/**
 * @param {{
 *  source_manifest?: import("./Featured.js").SourceManifest,
 *  entry: import("./Featured.js").SourceManifestNotebookEntry,
 *  direct_html_links: boolean,
 *  disable_links: boolean,
 *  image_loading?: string,
 * }} props
 */
export const FeaturedCard = ({ entry, source_manifest, direct_html_links, disable_links, image_loading }) => {
    const title = entry.frontmatter?.title

    const { source_url } = source_manifest ?? {}

    const u = (/** @type {string | null | undefined} */ x) =>
        source_url == null
            ? _.isEmpty(x)
                ? null
                : x
            : x == null
              ? null
              : // URLs are relative to the source URL...
                new URL(
                    x,
                    // ...and the source URL is relative to the current location
                    new URL(source_url, window.location.href)
                ).href

    // `direct_html_links` means that we will navigate you directly to the exported HTML file. Otherwise, we use our local editor, with the exported state as parameters. This lets users run the featured notebooks locally.
    const href = disable_links
        ? "#"
        : direct_html_links
          ? u(entry.html_path)
          : with_query_params(`edit`, {
                statefile: u(entry.statefile_path),
                notebookfile: u(entry.notebookfile_path),
                notebookfile_integrity: entry.hash == null ? null : `sha256-${base64url_to_base64(entry.hash)}`,
                disable_ui: `true`,
                name: title == null ? null : `sample ${title}`,
                pluto_server_url: `.`,
                // Little monkey patch because we don't want to use the slider server when for the CDN source, only for the featured.plutojl.org source. But both sources have the same pluto_export.json so this is easiest.
                slider_server_url: source_url?.includes("cdn.jsdelivr.net/gh/JuliaPluto/featured") ? null : u(source_manifest?.slider_server_url),
            })

    const author = author_info(entry.frontmatter)

    return html`
        <featured-card style=${`--card-color-hue: ${str_to_degree(entry.id)}deg;`}>
            <a class="banner" href=${href}><img src=${u(entry?.frontmatter?.image) ?? transparent_svg} loading=${image_loading} /></a>
            ${author?.name == null
                ? null
                : html`
                      <div class="author">
                          <img src=${author.image ?? transparent_svg} loading=${image_loading} />
                          <span>
                              <a href=${author.url}>${author.name}</a>
                              ${author.has_coauthors ? html` and others` : null}
                          </span>
                      </div>
                  `}
            <h3><a href=${href} title=${entry?.frontmatter?.title}>${entry?.frontmatter?.title ?? entry.id}</a></h3>
            <p title=${entry?.frontmatter?.description}>${entry?.frontmatter?.description}</p>
        </featured-card>
    `
}

/**
 * @typedef AuthorInfo
 * @type {{
 * name: string?,
 * url: string?,
 * image: string?,
 * has_coauthors?: boolean,
 * }}
 */

/**
 * @returns {AuthorInfo?}
 */
const author_info = (frontmatter) =>
    author_info_item(frontmatter.author) ??
    author_info_item({
        name: frontmatter.author_name,
        url: frontmatter.author_url,
        image: frontmatter.author_image,
    })

/**
 * @returns {AuthorInfo?}
 */
const author_info_item = (x) => {
    if (x instanceof Array) {
        const first = author_info_item(x[0])
        if (first?.name) {
            const has_coauthors = x.length > 1
            return { ...first, has_coauthors }
        }
    } else if (typeof x === "string") {
        return {
            name: x,
            url: null,
            image: null,
        }
    } else if (x instanceof Object) {
        let { name, image, url } = x

        if (image == null && !_.isEmpty(url)) {
            image = url + ".png?size=48"
        }

        return {
            name,
            url,
            image,
        }
    }
    return null
}
