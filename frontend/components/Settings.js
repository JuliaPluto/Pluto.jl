import { html, useEffect, useMemo, useState } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

//@ts-ignore
import { useDialog } from "../common/useDialog.js"
import { useEventListener } from "../common/useEventListener.js"
import { t, th } from "../common/lang.js"
import { downstream_recursive } from "../common/SliderServerClient.js"
import { pretty_long_time } from "./EditOrRunButton.js"
import { and, ctrl_or_cmd_name } from "../common/KeyboardShortcuts.js"
import { useMillisSinceTruthy } from "./RunArea.js"
import { cl } from "../common/ClassTable.js"
import { LanguagePicker } from "./LanguagePicker.js"

export const Settings = ({}) => {
    const [dialog_ref, open, close, _toggle, currently_open] = useDialog()

    useEventListener(
        window,
        "pluto open settings",
        () => {
            open()
        },
        [open]
    )

    const make_checkbox = () => html`<input type="checkbox" />`

    const settings_ui = [
        {
            title: "t_settings_lang_description",
            description: "t_settings_lang_description",
            component: html`<${LanguagePicker} />`,
        },
        {
            title: "Motivational stickers",
            description: "Show motivational stickers on error messages",
            component: make_checkbox(),
        },
        {
            title: "Browser notifications",
            description: "Always send a browser notification when the notebook has been busy for a long time",
            component: make_checkbox(),
        },
        {
            title: "",
            description: html`Enable educational AI features <a href="https://plutojl.org/en/docs/ai-editor-features/" target="_blank">(learn more)</a>`,
            component: make_checkbox(),
        },
    ]

    return html`<dialog ref=${dialog_ref} class="pluto-modal psettings">
        <h1>${t("t_settings_title")}</h1>
        <h2>User Interface</h2>
        <div class="big-list-of-settings">
            <label>
                <setting-label>${t("t_settings_lang_description")}</setting-label>
                <${LanguagePicker} />
            </label>

            <label>
                <setting-label>
                    <h4>Motivational stickers</h4>
                    <p>Show motivational stickers on error messages</p>
                </setting-label>
                <input type="checkbox" />
            </label>

            <label>
                <setting-label>Always send a browser notification when the notebook has been busy for a long time</setting-label>
                <input type="checkbox" />
            </label>

            <label>
                <setting-label
                    >Enable educational AI features <a href="https://plutojl.org/en/docs/ai-editor-features/" target="_blank">(learn more)</a></setting-label
                >
                <input type="checkbox" />
            </label>
        </div>
        <h2>Code Editing</h2>
        <div class="big-list-of-settings">
            <label>
                <setting-label>Use <kbd>TAB</kbd> for indentation and autocompletion (instead of moving focus)</setting-label>
                <input type="checkbox" />
            </label>
            <label>
                <setting-label>Default indentation unit</setting-label>
                <select>
                    <option value="4">4 spaces</option>
                    <option value="tab">Tab</option>
                </select>
            </label>

            <label>
                <setting-label>Supported nested syntax highlighting for Markdown, HTML, Python, SQL (experimental)</setting-label>
                <input type="checkbox" />
            </label>

            <label>
                <setting-label>Allow browser-based spell checking inside Markdown</setting-label>
                <input type="checkbox" />
            </label>

            <label>
                <setting-label>Show autocomplete suggestions automatically while typing</setting-label>
                <input type="checkbox" />
            </label>
        </div>
        <div class="final">
            <button class="final-no" onClick=${close} aria-label=${t("t_no")}>${th("t_no_key", { key: html`<kbd aria-hidden="true">Esc</kbd>` })}</button>
            <button
                autofocus
                onClick=${() => {
                    close()
                }}
                aria-label=${t("t_yes")}
            >
                <setting-label> ${th("t_yes_key", { key: html`<kbd aria-hidden="true">Enter</kbd>` })} </setting-label>
            </button>
        </div>
    </dialog>`
}
