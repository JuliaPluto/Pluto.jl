import _ from "../../imports/lodash.js"
import { html, useState } from "../../imports/Preact.js"

import { FilePicker } from "../FilePicker.js"
import { PasteHandler } from "../PasteHandler.js"
import { guess_notebook_location } from "../../common/NotebookLocationFromURL.js"
import { t, th } from "../../common/lang.js"

import * as desktop from "../DesktopInterface.js"
import { is_desktop } from "../DesktopInterface.js"

/**
 * @param {{
 *  client: import("../../common/PlutoConnection.js").PlutoConnection?,
 *  connected: Boolean,
 *  show_samples: Boolean,
 *  CustomPicker: {text: String, placeholder: String}?,
 *  on_start_navigation: (string) => void,
 * }} props
 */
export const Open = ({ client, connected, CustomPicker, show_samples, on_start_navigation }) => {
    const on_open_path = async (new_path) => {
        const processed = await guess_notebook_location(new_path)
        on_start_navigation(processed.display_url ?? processed.path_or_url)
        window.location.href = (processed.type === "path" ? link_open_path : link_open_url)(processed.path_or_url)
    }

    const picker = CustomPicker ?? {
        text: t("t_open_a_notebook_action"),
        placeholder: t("t_enter_path_or_url"),
    }

    // may be passed to FilePicker to disable autocomplete by spoofing an autocompletion client
    const dummy_client = {
        send: (_) => {
            return {
                then: (_) => {},
            }
        },
    }

    return html`<${PasteHandler} on_start_navigation=${on_start_navigation} />
        <h2>${picker.text}</h2>
        <div id="new" dir="ltr" class=${is_desktop() ? "desktop_opener" : ""}>
            ${is_desktop()
                ? html`
                      <div class="desktop_picker_group">
                          <button onClick=${desktop.open_from_path}>Open File</button>
                          <div class="option_splitter">— OR —</div>
                          <div>
                              <${FilePicker}
                                  key=${picker.placeholder}
                                  client=${client}
                                  value=""
                                  on_submit=${desktop.open_from_url}
                                  button_label=${"Open from URL"}
                                  placeholder=${"Enter a URL..."}
                                  client=${dummy_client}
                                  clear_on_blur=${false}
                              />
                          </div>
                      </div>
                  `
                : html`
                      <${FilePicker}
                          key=${picker.placeholder}
                          client=${client}
                          value=""
                          on_submit=${on_open_path}
                          clear_on_blur=${false}
                          button_label=${is_desktop() ? t("t_open_file_action") : t("t_open_action")}
                          placeholder=${picker.placeholder}
                      />
                  `}
        </div>`
}

export const link_open_path = (path, execution_allowed = false) => "open?" + new URLSearchParams({ path: path }).toString()
export const link_open_url = (url) => "open?" + new URLSearchParams({ url: url }).toString()
export const link_edit = (notebook_id) => "edit?id=" + notebook_id
