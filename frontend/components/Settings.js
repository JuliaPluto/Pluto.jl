import { html, useContext, useEffect, useMemo, useRef, useState } from "../imports/Preact.js"
import _ from "../imports/lodash-es.js"

//@ts-ignore
import { useDialog } from "../common/useDialog.js"
import { useEventListener } from "../common/useEventListener.js"
import { t, th } from "../common/lang.js"
import { LanguagePicker } from "./LanguagePicker.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { and, ctrl_or_cmd_name } from "../common/KeyboardShortcuts.js"

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

    const pluto_actions = useContext(PlutoActionsContext)

    const [require_reload, set_require_reload] = useState(false)

    const require_reload_ref = useRef(require_reload)
    require_reload_ref.current = require_reload

    useEffect(() => {
        if (currently_open) {
            set_require_reload(false)
        } else {
            if (require_reload_ref.current) {
                // Need a timeout so that the Esc to close the settings dialog does not dismiss the confirm.
                setTimeout(() => {
                    if (confirm(t("t_settings_reload_to_apply_changes_confirm"))) {
                        window.location.reload()
                    }
                }, 1000)
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
        html`<input
            id=${`setting_${setting_name}`}
            type="checkbox"
            checked=${!!settings[setting_name]}
            onChange=${(e) => set(setting_name, e.target.checked)}
        />`

    const make_textfield = (/** @type {keyof typeof DEFAULT_SETTINGS} */ setting_name, placeholder) =>
        html`<input
            id=${`setting_${setting_name}`}
            value=${settings[setting_name] ?? ""}
            onChange=${(e) => set(setting_name, e.target.value)}
            placeholder=${placeholder}
        />`

    const ai_disabled_from_backend = pluto_actions.get_session_options?.()?.server?.enable_ai_editor_features === false

    const settings_ui = [
        {
            title: th("t_settings_lang_title"),
            description: th("t_settings_lang_description"),
            component: html`<${LanguagePicker} onChanged=${() => set_require_reload(true)} />`,
        },
        {
            title: th("t_settings_motivational_stickers_title"),
            description: th("t_settings_motivational_stickers_description"),
            component: make_checkbox("MOTIVATIONAL_STICKERS"),
        },
        {
            title: th("t_settings_always_notify_title"),
            description: th("t_settings_always_notify_description"),
            component: make_checkbox("ALWAYS_NOTIFY_LONG_BUSY"),
        },
        {
            title: th("t_settings_confirm_long_runtimes_title"),
            description: th("t_settings_confirm_long_runtimes_description"),
            description_2: th("t_settings_confirm_long_runtimes_description_2"),
            component: html`<input
                type="number"
                min="0"
                value=${settings.CONFIRM_LONG_RUNTIMES_SECONDS}
                onChange=${(e) => set("CONFIRM_LONG_RUNTIMES_SECONDS", e.target.valueAsNumber)}
                max="99999"
            />`,
        },
        ...(ai_disabled_from_backend
            ? []
            : [
                  {
                      title: th("t_settings_ai_features_title"),
                      description: th("t_settings_ai_features_description", {
                          learn_more: html`<a href="https://plutojl.org/en/docs/ai-editor-features/" target="_blank"
                              >${t("t_settings_ai_features_learn_more")}</a
                          >`,
                      }),
                      component: make_checkbox("AI_EDITOR_FEATURES"),
                  },
              ]),
        {
            title: th("t_settings_dark_mode_title"),
            description: th("t_settings_dark_mode_description"),
            description_2: th("t_settings_dark_mode_description_2"),
            component: null,
            style: "cursor: unset;",
        },
    ]

    const settings_codemirror = [
        {
            title: th("t_settings_indent_unit_title"),
            description: th("t_settings_indent_unit_description"),
            description_2: th("t_settings_indent_unit_description_2"),
            component: html`<select onChange=${(e) => set("CM_INDENT_UNIT", e.target.value)}>
                <option value="4" selected=${settings.CM_INDENT_UNIT === "4"}>${t("t_settings_indent_unit_4_spaces")}</option>
                <option value="tab" selected=${settings.CM_INDENT_UNIT === "tab"}>${t("t_settings_indent_unit_tab")}</option>
            </select>`,
        },
        {
            title: th("t_settings_code_typeface_title"),
            description: th("t_settings_code_typeface_description"),
            description_2: th("t_settings_code_typeface_description_2"),
            component: make_textfield("CUSTOM_CODE_FONT_STACK", "JuliaMono"),
        },
        {
            title: th("t_settings_nested_syntax_title"),
            description: th("t_settings_nested_syntax_description"),
            component: make_checkbox("CM_MIXED_PARSER"),
        },
        {
            title: th("t_settings_spellcheck_title"),
            description: th("t_settings_spellcheck_description"),
            component: make_checkbox("CM_SPELLCHECK"),
        },
        {
            title: th("t_settings_autocomplete_title"),
            description: th("t_settings_autocomplete_description"),
            component: make_checkbox("CM_AUTOCOMPLETE_ON_TYPE"),
        },
    ]

    const settings_accessibility = [
        {
            title: th("t_settings_tab_key_title"),
            description: th("t_settings_tab_key_description"),
            description_2: th("t_settings_tab_key_indent", {
                ctrl_close: html`<kbd>${ctrl_or_cmd_name}</kbd>${and}<kbd>]</kbd>`,
                ctrl_open: html`<kbd>${ctrl_or_cmd_name}</kbd>${and}<kbd>[</kbd>`,
            }),
            component: make_checkbox("CM_TAB_KEY_FOR_INDENT"),
        },
    ]

    const render_setting = ({ title, description, component, style, description_2 }) => {
        return html`
            <label style=${style}>
                <setting-label>
                    ${title ? html`<h4>${title}</h4>` : null} ${description ? html`<p>${description}</p>` : description}
                    ${description_2 ? html`<p class="description-2">${description_2}</p>` : description_2}
                </setting-label>
                ${component}
            </label>
        `
    }

    return html`<dialog ref=${dialog_ref} class="pluto-modal psettings">
        <h1>${t("t_settings_title")}</h1>
        <h2>${t("t_settings_section_ui")}</h2>
        <div class="big-list-of-settings">${settings_ui.map(render_setting)}</div>
        <h2>${t("t_settings_section_code_editing")}</h2>
        <div class="big-list-of-settings">${settings_codemirror.map(render_setting)}</div>
        <h2>${t("t_settings_section_accessibility")}</h2>
        <div class="big-list-of-settings">${settings_accessibility.map(render_setting)}</div>
        <div class="final">
            <button
                class="final-reset"
                type="reset"
                aria-label=${t("t_settings_reset")}
                onClick=${() => {
                    clear_settings()
                    set_require_reload(true)
                    close()
                }}
            >
                ${t("t_settings_reset")}
            </button>
            <button
                onClick=${() => {
                    close()
                }}
                aria-label=${t("t_settings_save")}
            >
                ${t("t_settings_save")}
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
    CUSTOM_CODE_FONT_STACK: "",
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
 * @template {string & keyof typeof DEFAULT_SETTINGS} K
 * @param {K} key
 * @param {(typeof DEFAULT_SETTINGS)[K]} value
 */
export const set_setting = (key, value) => {
    localStorage.setItem(`pluto_setting_${key}`, JSON.stringify(value))
}

export const clear_settings = () => {
    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
        localStorage.removeItem(`pluto_setting_${key}`)
    })
}
