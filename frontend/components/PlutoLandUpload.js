import { html, useEffect, useState } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

//@ts-ignore
import { useDialog } from "../common/useDialog.js"
import { useEventListener } from "../common/useEventListener.js"
import { t, th } from "../common/lang.js"
import { exportNotebookDesktop, WarnForVisisblePasswords } from "./ExportBanner.js"
import { useMillisSinceTruthy } from "./RunArea.js"
import { cl } from "../common/ClassTable.js"

/** Add the &offline_bundle=true query parameter to a URL string */
export const with_offline_bundle_query = (/** @type {string | URL | undefined} */ url) => {
    if (!url) return url
    if (url?.toString().startsWith("data:")) return url
    const u = new URL(url, window.location.href)
    u.searchParams.set("offline_bundle", "true")
    return u.toString()
}

/**
 * @param {{
 *  notebook_id: String,
 * }} props
 * */
export const PlutoLandUpload = ({ notebook_id }) => {
    const [dialog_ref, open, close, _toggle] = useDialog()
    const [open_event_detail, set_open_event_detail] = useState(/** @type {Record<string, unknown>} */ ({}))
    const { download_url, download_filename } = open_event_detail

    useEventListener(
        window,
        "open pluto html export",
        (/** @type {CustomEvent} */ e) => {
            set_open_event_detail(e.detail)
            open()
        },
        [open, set_open_event_detail]
    )

    const [upload_flow_state, set_upload_flow_state] = useState("waiting")
    const [plutoland_data, set_plutoland_data] = useState(/** @type Record<string, unknown> */ ({}))

    const [upload_progress, set_upload_progress] = useState(0)

    // Show some fake progress while the server is processing the upload
    const [fake_progressing, set_fake_progressing] = useState(false)
    const fake_progress = useMillisSinceTruthy(fake_progressing)
    useEffect(() => {
        if (fake_progressing && fake_progress) {
            const y = 1.0 - Math.exp(-2 * (fake_progress / 1000))
            set_upload_progress(Math.min(0.7 + y * 0.3, 1.0))
        }
    }, [fake_progress, fake_progressing])

    const on_plutoland_upload = async () => {
        try {
            set_upload_flow_state("generating")
            set_upload_progress(0)

            // We download the HTML export **without** offline bundle. This makes the file much smaller so there is less work for pluto.land.
            const notebook_response = await fetch(String(download_url))
            const notebook_blob = await notebook_response.blob()

            set_upload_flow_state("uploading")
            set_upload_progress(0.1)
            const response = await upload_to_plutoland(notebook_blob, (progress) => {
                set_upload_progress(0.1 + progress * 0.6)
                if (progress >= 1.0) set_fake_progressing(true)
            })

            console.log(response)

            if (response.status === 200) {
                const data = JSON.parse(response.response)
                console.log(data)
                set_plutoland_data(data)
                set_upload_flow_state("success")
            } else {
                set_upload_flow_state("error: Upload failed")
            }
        } catch (error) {
            set_upload_flow_state("error: " + error)
        }
    }

    const prog = html`<progress class="ple-plutoland-progress" max="100" value=${upload_progress * 100}>${Math.round(upload_progress * 100)}%</progress>`

    const is_recording = open_event_detail.is_recording ?? false

    return html`<dialog ref=${dialog_ref} class="export-html-dialog">
        <div class="ple-download ple-option">
            <p>${th(is_recording ? "t_plutoland_download_description_recording" : "t_plutoland_download_description")}</p>
            <div class="ple-bigbutton-container">
                <a
                    class="ple-bigbutton"
                    href=${String(download_url)}
                    target="_blank"
                    download=${download_filename ?? ""}
                    onClick=${(e) => {
                        exportNotebookDesktop(e, 1, notebook_id)
                        close()
                    }}
                >
                    ${th("t_plutoland_download")} ${InlineIonicon("download-outline", { inlineMargin: true })}
                </a>
            </div>
        </div>
        <div class="ple-or" aria-hidden="true"><span>${th("t_plutoland_choose_up_or_down")}</span></div>
        <div class="ple-plutoland ple-option">
            <p>
                ${th(is_recording ? "t_plutoland_upload_description_recording" : "t_plutoland_upload_description", {
                    plutoland: html`<a href="https://pluto.land/" target="_blank">pluto.land</a>`,
                })}
            </p>
            <div class="ple-bigbutton-container">
                ${upload_flow_state === "waiting"
                    ? html`
                          <a
                              class="ple-bigbutton"
                              href="https://pluto.land/"
                              target="_blank"
                              download=""
                              onClick=${(e) => {
                                  e.preventDefault()
                                  on_plutoland_upload()
                              }}
                          >
                              ${th("t_plutoland_upload_upload", {
                                  plutoland: html`<strong>pluto.land</strong>`,
                              })}
                              ${InlineIonicon("cloud-upload-outline", { inlineMargin: true })}
                          </a>
                      `
                    : upload_flow_state === "uploading" || upload_flow_state === "generating"
                      ? html` <div class="ple-plutoland-phase">
                            <p>${th("t_plutoland_upload_uploading")}</p>
                            ${prog}
                        </div>`
                      : upload_flow_state === "success"
                        ? html` <div class="ple-plutoland-phase">
                              <p>${th(is_recording ? "t_plutoland_upload_success_recording" : "t_plutoland_upload_success")}</p>
                              <div class="ple-plutoland-url-container">
                                  <a href=${`https://pluto.land/n/${plutoland_data.id}`} target="_blank" class="ple-plutoland-url">
                                      ${`https://pluto.land/n/${plutoland_data.id}`}
                                  </a>
                                  <a
                                      href="#"
                                      title=${t("t_plutoland_upload_delete")}
                                      onClick=${async (e) => {
                                          e.preventDefault()

                                          await fetch(`https://pluto.land/n/${plutoland_data.id}`, {
                                              method: "DELETE",
                                              headers: {
                                                  "X-Creation-Secret": String(plutoland_data.creation_secret),
                                              },
                                          })
                                          set_upload_flow_state("waiting")
                                          set_plutoland_data({})
                                      }}
                                  >
                                      ${InlineIonicon("trash-bin-outline", { inlineMargin: true })}
                                  </a>
                              </div>
                          </div>`
                        : html` <div class="ple-plutoland-phase">Error: ${upload_flow_state}</div>`}
            </div>
        </div>
        <div class="final"><button onClick=${close}>${t("t_frontmatter_cancel")}</button></div>
    </dialog>`
}

export const InlineIonicon = (icon_name, { inlineMargin = false } = {}) => {
    return html`<span class=${cl({ "ionicon-icon": true, "ionicon-icon-margin": inlineMargin })} data-icon=${icon_name} data-inline="true"></span>`
}

// Transfer file data to the pluto.land API
/** @returns {Promise<XMLHttpRequest>} */
const upload_to_plutoland = (/** @type {File | Blob} */ filesource, onprogress = (val, xhr) => {}) =>
    new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest()

        xhr.onload = function (e) {
            console.log("done", e, xhr)
            onprogress(1.0, xhr)

            resolve(xhr)
        }

        xhr.onerror = reject
        xhr.onabort = reject

        xhr.open("POST", "https://pluto.land/n", true)

        xhr.upload.onprogress = function (e) {
            console.log("progress", e, xhr)
            let progress = e.loaded / e.total
            onprogress(progress, xhr)
        }
        let data = new FormData()
        data.append("file0", filesource)
        xhr.send(data)
    })
