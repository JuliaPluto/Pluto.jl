import { html, useEffect, useMemo, useRef, useState } from "../imports/Preact.js"
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
import { require } from "../common/SetupCellEnvironment.js"

export const Settings = ({}) => useMemo(() => html`<${_Settings} />`, [])

const _Settings = ({}) => {
    const [dialog_ref, open, close, _toggle, currently_open] = useDialog()

    useEventListener(
        window,
        "pluto open settings",
        () => {
            open()
        },
        [open]
    )

    const [require_reload, set_require_reload] = useState(false)

    const require_reload_ref = useRef(require_reload)
    require_reload_ref.current = require_reload

    useEffect(() => {
        // If the dialog gets closed (e.g. by the user pressing Esc)
        // if (!currently_open && typeof on_result === "function") {
        //     on_result(false)
        // }
        // TODO
        if (currently_open) {
            set_require_reload(false)
        } else {
            if (require_reload_ref.current) {
                requestAnimationFrame(() => {
                    if (confirm(t("t_settings_reload_to_apply_changes_confirm"))) {
                        window.location.reload()
                    }
                })
            }
        }
    }, [currently_open])

    const settings = get_settings()

    /**
     * @template {keyof typeof DEFAULT_SETTINGS} K
     * @param {K} key
     * @param {(typeof DEFAULT_SETTINGS)[K]} value
     */
    const set = (key, value) => {
        set_setting(key, value)
        set_require_reload(true)
    }

    const make_checkbox = (/** @type {keyof typeof DEFAULT_SETTINGS} */ setting_name) =>
        html`<input type="checkbox" checked=${!!settings[setting_name]} onChange=${(e) => set(setting_name, e.target.checked)} />`

    const settings_ui = [
        {
            title: "t_settings_lang_title",
            description: "t_settings_lang_description",
            component: html`<${LanguagePicker} />`,
        },
        {
            title: "Motivational stickers",
            description: "Show motivational stickers on error messages",
            // TODO
            component: make_checkbox("MOTIVATIONAL_STICKERS"),
        },
        {
            title: "Always notify",
            description: "Always send a browser notification when the notebook completes after having been busy for a long time",
            // TODO
            component: make_checkbox("ALWAYS_NOTIFY_LONG_BUSY"),
        },
        {
            title: "Confirm long runtimes",
            description: html`Pluto will ask for confirmation before running cells if the estimated runtime is very long. You can set the threshold here in
                seconds. <em>Setting it to a very high value disables the confirmation.</em>`,
            component: html`<input
                type="number"
                min="0"
                value=${settings.CONFIRM_LONG_RUNTIMES_SECONDS}
                onChange=${(e) => set("CONFIRM_LONG_RUNTIMES_SECONDS", e.target.valueAsNumber)}
                max="99999"
            />`,
        },
        {
            title: "AI features",
            description: html`Enable educational AI features <a href="https://plutojl.org/en/docs/ai-editor-features/" target="_blank">(learn more)</a>`,
            // TODO
            component: make_checkbox("AI_EDITOR_FEATURES"),
        },
        {
            title: "Dark mode",
            description: "Pluto will automatically adapt to your system theme (light/dark). Change your system theme to see the effect.",
            component: null,
        },
    ]

    const settings_codemirror = [
        {
            title: "Default indentation unit",
            description: "",
            // TODO
            component: html`<select>
                <option value="4">4 spaces</option>
                <option value="tab">Tab</option>
            </select>`,
        },
        {
            title: "Nested syntax highlighting",
            description: "Supported nested syntax highlighting for Markdown, HTML, Python, SQL (experimental)",
            component: make_checkbox("CM_MIXED_PARSER"),
        },
        {
            title: "Spell checking",
            description: "Allow browser-based spell checking inside Markdown",
            component: make_checkbox("CM_SPELLCHECK"),
        },
        {
            title: "Autocomplete",
            description: "Show autocomplete suggestions automatically while you type. You can always trigger autocomplete manually with Ctrl+Space.",
            component: make_checkbox("CM_AUTOCOMPLETE_ON_TYPE"),
        },
    ]

    const settings_accessibility = [
        {
            title: "Tab key behavior",
            description: html`Use <kbd>TAB</kbd> for indentation and autocompletion. Disable this setting if you prefer to use <kbd>TAB</kbd> for moving focus
                between elements on the page.`,
            // TODO
            component: make_checkbox("CM_TAB_KEY_FOR_INDENT"),
        },
    ]

    const render_setting = ({ title, description, component }) => html`
        <label>
            <setting-label>
                ${title ? html`<h4>${t(title)}</h4>` : null} ${typeof description === "string" ? html`<p>${t(description)}</p>` : description}
            </setting-label>
            ${component}
        </label>
    `

    return html`<dialog ref=${dialog_ref} class="pluto-modal psettings">
        <h1>${t("t_settings_title")}</h1>
        <h2>User Interface</h2>
        <div class="big-list-of-settings">${settings_ui.map(render_setting)}</div>
        <h2>Code Editing</h2>
        <div class="big-list-of-settings">${settings_codemirror.map(render_setting)}</div>
        <h2>Accessibility</h2>
        <div class="big-list-of-settings">${settings_accessibility.map(render_setting)}</div>
        <div class="final">
            <button class="final-no" onClick=${close} aria-label=${t("t_no")}>${th("t_no_key", { key: html`<kbd aria-hidden="true">Esc</kbd>` })}</button>
            <button
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

export const DEFAULT_SETTINGS = {
    // note: language is not stored here.
    AI_EDITOR_FEATURES: true,
    MOTIVATIONAL_STICKERS: true,
    ALWAYS_NOTIFY_LONG_BUSY: false,
    CONFIRM_LONG_RUNTIMES_SECONDS: 120,
    CM_AUTOCOMPLETE_ON_TYPE: true,
    CM_SPELLCHECK: false,
    CM_MIXED_PARSER: false,
    CM_INDENT_UNIT: "tab",
    CM_TAB_KEY_FOR_INDENT: true,
}

/**
 * @returns {typeof DEFAULT_SETTINGS}
 */
export const get_settings = () =>
    /** @type {typeof DEFAULT_SETTINGS} */ (
        Object.fromEntries(
            Object.keys(DEFAULT_SETTINGS).map((key) => {
                const raw = localStorage.getItem(`pluto_setting_${key}`)
                if (raw == null) return [key, DEFAULT_SETTINGS[key]]
                try {
                    return [key, JSON.parse(raw)]
                } catch (e) {
                    console.error(`Failed to JSON.parse pluto_setting_${key}, falling back to default.`, e)
                    return [key, DEFAULT_SETTINGS[key]]
                }
            })
        )
    )

/**
 * @template {keyof typeof DEFAULT_SETTINGS} K
 * @param {K} key
 * @param {(typeof DEFAULT_SETTINGS)[K]} value
 */
export const set_setting = (key, value) => {
    localStorage.setItem(`pluto_setting_${key}`, JSON.stringify(value))
}
