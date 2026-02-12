import { t, th } from "../common/lang.js"
import { open_pluto_popup } from "../common/open_pluto_popup.js"
import _ from "../imports/lodash.js"
import { html } from "../imports/Preact.js"

export const SafePreviewUI = ({ process_waiting_for_permission, risky_file_source, restart, warn_about_untrusted_code }) => {
    return html`
        <div class="outline-frame safe-preview"></div>
        ${process_waiting_for_permission
            ? html`<div class="outline-frame-actions-container safe-preview">
                  <div class="safe-preview-info">
                      <span
                          >${t("t_safe_preview")}
                          <button
                              onclick=${(e) => {
                                  open_pluto_popup({
                                      type: "info",
                                      big: true,
                                      should_focus: true,
                                      body: html`
                                          <h1>${th("t_safe_preview")}</h1>
                                          <p>${th("t_safe_preview_body")}</p>

                                          <p>
                                              ${th("t_safe_preview_run_this_notebook", {
                                                  run_this_notebook: html`<a
                                                      href="#"
                                                      onClick=${(e) => {
                                                          e.preventDefault()
                                                          restart(true)
                                                          window.dispatchEvent(new CustomEvent("close pluto popup"))
                                                      }}
                                                      >${t("t_safe_preview_run_this_notebook_link")}</a
                                                  >`,
                                              })}
                                          </p>
                                          ${warn_about_untrusted_code
                                              ? html`
                                                    <pluto-output translate="yes" class="rich_output"
                                                        ><div class="markdown">
                                                            <div class="admonition warning">
                                                                <p class="admonition-title">${t("t_safe_preview_confirm_warning")}</p>
                                                                <p>${t("t_safe_preview_confirm_before")}</p>
                                                                ${risky_file_source == null ? null : html`<p><code>${risky_file_source}</code></pre>`}
                                                                <p>${t("t_safe_preview_confirm_after")}</p>
                                                            </div>
                                                        </div></pluto-output
                                                    >
                                                `
                                              : null}
                                      `,
                                  })
                              }}
                          >
                              <span><span class="info-icon pluto-icon"></span></span>
                          </button>
                      </span>
                  </div>
              </div>`
            : null}
    `
}

export const SafePreviewOutput = () => {
    return html`<pluto-output class="rich_output"
        ><div class="safe-preview-output"><span class="offline-icon pluto-icon"></span><span>${th("t_safe_preview_not_executed")}</span></div></pluto-output
    >`
}

/** @type {string} */ // Because this is used as innerHTML content, without preact.
export const SafePreviewSanitizeMessage = `<div class="safe-preview-output">
<span class="offline-icon pluto-icon"></span><span>${t("t_safe_preview_not_rendered")}</span>
</div>`
