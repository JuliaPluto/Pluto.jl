import _ from "../imports/lodash.js"
import { html, useEffect, useState, useRef } from "../imports/Preact.js"

import { useDialog } from "../common/useDialog.js"
import { t, th } from "../common/lang.js"

export const RunLocalButton = ({ show, start_local }) => {
    //@ts-ignore
    window.open_edit_or_run_popup = () => {
        start_local()
    }

    return html`<button
        class="edit_or_run_button"
        onClick=${(e) => {
            e.stopPropagation()
            e.preventDefault()
            start_local()
        }}
    >
        <span class="yayicon"></span>
        <span class="text">${th("t_edit_or_run_this_notebook")}</span>
    </button>`
}

/**
 * @param {{
 *  notebook: import("./Editor.js").NotebookData,
 *  notebookfile: string?,
 *  start_binder: () => Promise<void>,
 *  offer_binder: boolean,
 * }} props
 * */
export const BinderButton = ({ offer_binder, start_binder, notebookfile, notebook }) => {
    const [dialog_ref, openModal, closeModal, toggleModal] = useDialog()

    const [showCopyPopup, setShowCopyPopup] = useState(false)
    const notebookfile_ref = useRef("")
    notebookfile_ref.current = notebookfile ?? ""

    //@ts-ignore
    window.open_edit_or_run_popup = openModal

    useEffect(() => {
        //@ts-ignore
        // allow user-written JS to start the binder
        window.start_binder = offer_binder ? start_binder : null
        return () => {
            //@ts-ignore
            window.start_binder = null
        }
    }, [start_binder, offer_binder])

    const recommend_download = notebookfile_ref.current.startsWith("data:")
    const runtime_str = expected_runtime_str(notebook)

    return html`<button
            class="edit_or_run_button"
            onClick=${(e) => {
                toggleModal()
                e.stopPropagation()
                e.preventDefault()
            }}
        >
            <span class="yayicon"></span>
            <span class="text">${th("t_edit_or_run_this_notebook")}</span>
        </button>
        <dialog ref=${dialog_ref} class="binder_help_text">
            <span onClick=${closeModal} class="close"></span>
            ${offer_binder
                ? html`
                      <p style="text-align: center;">
                          ${t("t_edit_or_run_description_1")}
                          <b>${th("t_edit_or_run_description_2")}</b>
                      </p>
                      ${runtime_str == null ? null : html` <div class="expected_runtime_box">${th("t_edit_or_run_runtime", { runtime: runtime_str })}</div>`}
                      <h2 style="margin-top: 3em;">${th("t_binder_help_text_title")}</h2>
                      <div style="padding: 0 2rem;">
                          <button onClick=${start_binder}>
                              <img src="https://cdn.jsdelivr.net/gh/jupyterhub/binderhub@0.2.0/binderhub/static/logo.svg" height="30" alt="binder" />
                          </button>
                      </div>
                      <p style="opacity: .5; margin: 20px 10px;">${th("t_binder_help_text")}</p>
                      <h2 style="margin-top: 4em;">${th("t_edit_or_run_local")}</h2>
                      <p style="opacity: .5;">${th("t_edit_or_run_local_description")}</p>
                  `
                : null}
            <ol style="padding: 0 2rem;">
                <li>
                    <div>
                        ${recommend_download
                            ? html`
                                  <div class="command">${th("t_edit_or_run_download_notebook")}</div>
                                  <div
                                      onClick=${(e) => {
                                          e.target.tagName === "A" || e.target.closest("div").firstElementChild.click()
                                      }}
                                      class="download_div"
                                  >
                                      <a href=${notebookfile_ref.current} target="_blank" download="notebook.jl">notebook.jl</a>
                                      <span class="download_icon"></span>
                                  </div>
                              `
                            : html`
                                  <div class="command">${th("t_edit_or_run_copy_notebook_url")}</div>
                                  <div class="copy_div">
                                      <input onClick=${(e) => e.target.select()} value=${notebookfile_ref.current} readonly />
                                      <span
                                          class=${`copy_icon ${showCopyPopup ? "success_copy" : ""}`}
                                          onClick=${async () => {
                                              await navigator.clipboard.writeText(notebookfile_ref.current)
                                              setShowCopyPopup(true)
                                              setTimeout(() => setShowCopyPopup(false), 3000)
                                          }}
                                      />
                                  </div>
                              `}
                    </div>
                </li>
                <li>
                    <div class="command">${t("t_edit_or_run_run_pluto")}</div>
                    <p>${th("t_edit_or_run_run_pluto_description", { url: "https://plutojl.org/#install" })}</p>
                    <img src="https://plutojl.org/assets/img/terminal%20run%20pluto.png" />
                </li>
                <li>
                    ${recommend_download
                        ? html`
                              <div class="command">${th("t_edit_or_run_open_the_notebook_file")}</div>
                              <p>${th("t_edit_or_run_open_the_notebook_file_description")}</p>
                              <img src="https://plutojl.org/assets/img/open%20notebook%20path%20or%20url.png" />
                          `
                        : html`
                              <div class="command">${th("t_edit_or_run_paste_url_in_the_open_box")}</div>
                              <img src="https://plutojl.org/assets/img/open%20notebook%20path%20or%20url.png" />
                          `}
                </li>
            </ol>
        </dialog>`
}

const expected_runtime = (/** @type {import("./Editor.js").NotebookData} */ notebook) => {
    return ((notebook.nbpkg?.install_time_ns ?? NaN) + _.sum(Object.values(notebook.cell_results).map((c) => c.runtime ?? 0))) / 1e9
}

const runtime_overhead = 15 // seconds
const runtime_multiplier = 1.5

const expected_runtime_str = (/** @type {import("./Editor.js").NotebookData} */ notebook) => {
    const ex = expected_runtime(notebook)
    if (isNaN(ex)) {
        return null
    }

    const sec = _.round(runtime_overhead + ex * runtime_multiplier, -1)
    return pretty_long_time(sec)
}

export const pretty_long_time = (/** @type {number} */ sec) => {
    const min = sec / 60
    const sec_r = Math.ceil(sec)
    const min_r = Math.round(min)

    if (sec < 60) {
        return t("t_time_seconds", { count: sec_r })
    } else {
        return t("t_time_minutes", { count: min_r })
    }
}
