import { html, useRef, useLayoutEffect, useState, useEffect, useCallback } from "../imports/Preact.js"
import { has_ctrl_or_cmd_pressed } from "../common/KeyboardShortcuts.js"
import _ from "../imports/lodash.js"

import "https://cdn.jsdelivr.net/gh/fonsp/rebel-tag-input@1.0.6/lib/rebel-tag-input.mjs"

//@ts-ignore
import immer from "../imports/immer.js"
import { useDialog } from "../common/useDialog.js"
import { FeaturedCard } from "./welcome/FeaturedCard.js"
import { useEventListener } from "../common/useEventListener.js"
import { t } from "../common/lang.js"

/**
 * @param {{
 *  filename: String,
 *  remote_frontmatter: Record<String,any>?,
 *  set_remote_frontmatter: (newval: Record<String,any>) => Promise<void>,
 * }} props
 * */
export const FrontMatterInput = ({ filename, remote_frontmatter, set_remote_frontmatter }) => {
    const [frontmatter, set_frontmatter] = useState(remote_frontmatter ?? {})

    useEffect(() => {
        set_frontmatter(remote_frontmatter ?? {})
    }, [remote_frontmatter])

    const fm_setter = (key) => (value) =>
        set_frontmatter(
            immer((fm) => {
                _.set(fm, key, value)
            })
        )

    const [dialog_ref, open, close, _toggle] = useDialog()

    const cancel = () => {
        set_frontmatter(remote_frontmatter ?? {})
        close()
    }

    const set_remote_frontmatter_ref = useRef(set_remote_frontmatter)
    set_remote_frontmatter_ref.current = set_remote_frontmatter

    const submit = useCallback(() => {
        set_remote_frontmatter_ref.current(clean_data(frontmatter) ?? {}).then(() => alert(t("t_frontmatter_synchronized")))
        close()
    }, [clean_data, frontmatter, close])

    useEventListener(window, "open pluto frontmatter", open, [open])

    useEventListener(
        window,
        "keydown",
        (e) => {
            if (dialog_ref.current != null) if (dialog_ref.current.contains(e.target)) if (e.key === "Enter" && has_ctrl_or_cmd_pressed(e)) submit()
        },
        [submit]
    )

    const frontmatter_with_defaults = {
        title: null,
        description: null,
        date: null,
        image: null,
        tags: [],
        author: [{}],
        language: null,
        ...frontmatter,
    }

    const show_entry = ([key, value]) => !((_.isArray(value) && field_type(key) !== "tags") || _.isPlainObject(value))

    const entries_input = (data, base_path) => {
        return html`
            ${Object.entries(data)
                .filter(show_entry)
                .map(([key, value]) => {
                    let path = `${base_path}${key}`
                    let id = `fm-${path}`
                    return html`
                        <label for=${id}>${key}</label>
                        <${Input} type=${field_type(key)} id=${id} value=${value} on_value=${fm_setter(path)} />
                        <button
                            class="deletefield"
                            title=${t("t_frontmatter_delete_field")}
                            aria-label=${t("t_frontmatter_delete_field")}
                            onClick=${() => {
                                //  TODO
                                set_frontmatter(
                                    immer((fm) => {
                                        _.unset(fm, path)
                                    })
                                )
                            }}
                        >
                            ✕
                        </button>
                    `
                })}
            <button
                class="addentry"
                onClick=${() => {
                    const fieldname = prompt("Field name:")
                    if (fieldname) {
                        set_frontmatter(
                            immer((fm) => {
                                _.set(fm, `${base_path}${fieldname}`, null)
                            })
                        )
                    }
                }}
            >
                ${t("t_frontmatter_add_field", { plus: "+" })}
            </button>
        `
    }

    return html`<dialog ref=${dialog_ref} class="pluto-modal pluto-frontmatter">
        <h1>${t("t_frontmatter_title")}</h1>
        <p>${t("t_frontmatter_description")}</p>
        <div class="card-preview" aria-hidden="true">
            <h2>${t("t_frontmatter_preview")}</h2>
            <${FeaturedCard}
                entry=${
                    /** @type {import("./welcome/Featured.js").SourceManifestNotebookEntry} */ ({
                        id: filename.replace(/\.jl$/, ""),
                        hash: "xx",
                        frontmatter: clean_data(frontmatter) ?? {},
                    })
                }
                image_loading=${"lazy"}
                disable_links=${true}
            />
        </div>
        <div class="fm-table">
            ${entries_input(frontmatter_with_defaults, ``)}
            ${!_.isArray(frontmatter_with_defaults.author)
                ? null
                : frontmatter_with_defaults.author.map((author, i) => {
                      let author_with_defaults = {
                          name: null,
                          url: null,
                          ...author,
                      }

                      return html`
                          <fieldset class="fm-table">
                              <legend>Author ${i + 1}</legend>

                              ${entries_input(author_with_defaults, `author[${i}].`)}
                          </fieldset>
                      `
                  })}
            ${!_.isArray(frontmatter_with_defaults.author)
                ? null
                : html`<button
                      class="addentry"
                      onClick=${() => {
                          set_frontmatter((fm) => ({ ...fm, author: [...(fm?.author ?? []), {}] }))
                      }}
                  >
                      ${t("t_frontmatter_add_author", { plus: "+" })}
                  </button>`}
        </div>

        <div class="final"><button onClick=${cancel}>${t("t_frontmatter_cancel")}</button><button onClick=${submit}>${t("t_frontmatter_save")}</button></div>
    </dialog>`
}

const clean_data = (obj) => {
    let a = _.isPlainObject(obj)
        ? Object.fromEntries(
              Object.entries(obj)
                  .map(([key, val]) => [key, clean_data(val)])
                  .filter(([key, val]) => val != null)
          )
        : _.isArray(obj)
          ? obj.map(clean_data).filter((x) => x != null)
          : obj

    return !_.isNumber(a) && _.isEmpty(a) ? null : a
}

let test = clean_data({ a: 1, b: "", c: null, d: [], e: [1, "", null, 2], f: {}, g: [{}], h: [{ z: "asdf" }] })

console.assert(
    _.isEqual(test, {
        a: 1,
        e: [1, 2],
        h: [{ z: "asdf" }],
    }),
    test
)

const special_field_names = ["tags", "date", "license", "url", "color", "language"]

const field_type = (name) => {
    if (name === "image") return "url"
    for (const t of special_field_names) {
        if (name === t || name.endsWith(`_${t}`)) {
            return t
        }
    }
    return "text"
}

const Input = ({ value, on_value, type, id }) => {
    const input_ref = useRef(/** @type {HTMLInputElement?} */ (null))

    useLayoutEffect(() => {
        if (!input_ref.current) return
        input_ref.current.value = value
    }, [input_ref.current, value])

    useLayoutEffect(() => {
        if (!input_ref.current) return
        const listener = (e) => {
            if (!input_ref.current) return
            on_value(input_ref.current.value)
        }

        input_ref.current.addEventListener("input", listener)
        return () => {
            input_ref.current?.removeEventListener("input", listener)
        }
    }, [input_ref.current])

    const placeholder = type === "url" ? "https://..." : type === "language" ? t("t_frontmatter_language_placeholder") : undefined

    const pattern =
        type === "language"
            ? // https://stackoverflow.com/a/60899733
              "^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUse>x(-[A-Za-z0-9]{1,8})+))?)|(?<privateUse1>x(-[A-Za-z0-9]{1,8})+))$"
            : undefined

    return type === "tags"
        ? html`<rbl-tag-input id=${id} ref=${input_ref} />`
        : type === "license"
          ? LicenseInput({ ref: input_ref, id })
          : html`<input dir="auto" type=${type} id=${id} ref=${input_ref} placeholder=${placeholder} pattern=${pattern} title=${placeholder} />`
}

// https://choosealicense.com/licenses/
// and check https://github.com/sindresorhus/spdx-license-list/blob/HEAD/spdx-simple.json
const code_licenses = ["AGPL-3.0", "GPL-3.0", "LGPL-3.0", "MPL-2.0", "Apache-2.0", "MIT", "BSL-1.0", "Unlicense"]

// https://creativecommons.org/about/cclicenses/
// and check https://github.com/sindresorhus/spdx-license-list/blob/HEAD/spdx-simple.json
const creative_licenses = ["CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "CC-BY-ND-4.0", "CC-BY-NC-ND-4.0", "CC0-1.0"]

const licenses = [...code_licenses, ...creative_licenses]

const LicenseInput = ({ ref, id }) => {
    return html`
        <input ref=${ref} id=${id} type="text" list="oss-licenses" />
        <datalist id="oss-licenses">${licenses.map((name) => html`<option>${name}</option>`)}</datalist>
    `
}
