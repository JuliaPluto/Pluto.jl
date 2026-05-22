import * as preact from "../imports/Preact.js"
import { html } from "../imports/Preact.js"
import { getCurrentLanguage, getAvailableLanguages, changeLanguage, t } from "../common/lang.js"

/**
 * Language picker component for the footer
 */
export const LanguagePicker = ({ onChanged = () => {} }) => {
    const [currentLanguage, setCurrentLanguage] = preact.useState(getCurrentLanguage())
    const availableLanguages = getAvailableLanguages()

    const handleLanguageChange = async (event) => {
        if (event.target.value === "contribute") {
            window.open("https://github.com/JuliaPluto/Pluto.jl/tree/main/frontend/lang", "_blank")
            return
        }

        const selectedLanguage = event.target.value
        setCurrentLanguage(selectedLanguage)
        await changeLanguage(selectedLanguage)

        // Offer to refresh the page to see the language change
        onChanged()
    }

    return html`
        <div class="language-picker">
            <select
                class="language-picker"
                id="language-select"
                aria-label=${t("t_language_picker_description")}
                title=${t("t_language_picker_description")}
                value=${currentLanguage}
                onChange=${handleLanguageChange}
            >
                ${availableLanguages.map(
                    (lang) => html`<option value=${lang.code}>${lang.name}${lang.completeness < 98 ? ` (${lang.completeness}%)` : ""}</option>`
                )}
                <option value="contribute">💡 Help translate!</option>
            </select>
        </div>
    `
}
