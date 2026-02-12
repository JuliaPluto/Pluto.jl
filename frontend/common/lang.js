import { html } from "../imports/Preact.js"
import _ from "../imports/lodash.js"

// This file does not use i18next because of the following reasons:
// - Depending on a library requires more maintenance.
// - The package provides a lot of additional functionality that we don't need.
// - The main funcionality we need is simple enough.

import {
    // in alphabetical order
    chinese_simplified,
    dansk,
    deutsch,
    ellinika,
    english,
    español,
    farsi,
    french,
    italiano,
    japanese,
    nederlands_nl,
    norsk_bokmål,
    polski,
    portugues_pt,
    suomi,
    corporate_english,
} from "../imports/lang_imports.js"

const without_empty_keys = (obj) => {
    return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== ""))
}

const resources = {
    "zh": without_empty_keys(chinese_simplified),
    "da": without_empty_keys(dansk),
    "de": without_empty_keys(deutsch),
    "el": without_empty_keys(ellinika),
    "en": english,
    "en-US-x-corp": without_empty_keys(corporate_english),
    "es-419": without_empty_keys(español),
    "fa": without_empty_keys(farsi),
    "fi": without_empty_keys(suomi),
    "fr": without_empty_keys(french),
    "it": without_empty_keys(italiano),
    "ja": without_empty_keys(japanese),
    "nl-NL": without_empty_keys(nederlands_nl),
    "nb": without_empty_keys(norsk_bokmål),
    "pt-PT": without_empty_keys(portugues_pt),
    "pl": without_empty_keys(polski),
}

export const t = (/** @type {string} */ key, options = {}) => {
    const { count, interpolation = {}, returnObjects = false, defaultValue = key, fallbackLng = true, lng } = options
    const { escapeValue = false } = interpolation // not implemented

    const lang = lng ?? getCurrentLanguage()

    const find_entry = (search_lang) => {
        let keys_to_search = [key]
        if (count != null && typeof count === "number") {
            keys_to_search = [`${key}_${new Intl.PluralRules(lang).select(count)}`, key]
        }

        for (const key of keys_to_search) {
            const entry = resources[search_lang]?.[key]
            if (entry != null) return entry
        }
        return null
    }

    /** @type {string | Object | string[]} */
    const found =
        find_entry(lang) ??
        (fallbackLng ? find_entry("en") : null) ??
        (() => {
            console.warn(`Missing localization for key "${key}" in language "${lang}"`)
            return defaultValue
        })()
    if (returnObjects) return found

    return Object.keys(options).reduce(
        (str, interp) =>
            // Interpolate
            str.replaceAll(`{{${interp}}}`, options[interp]),
        found
    )
}

/**
 * Get available languages with their display names and translation completeness
 * @returns {Array<{code: string, name: string, completeness: number}>}
 */
export const getAvailableLanguages = () => {
    const languages = Object.keys(resources)
    const englishKeys = Object.keys(resources.en ?? {})
    const totalKeys = englishKeys.length

    return languages.map((lang) => {
        const lang_entries = Object.entries(resources[lang] ?? {}).filter(([key, value]) => value !== "")
        const completeness = totalKeys > 0 ? Math.round((lang_entries.length / totalKeys) * 100) : 100

        return {
            code: lang,
            name: t(`t_language_name`, { lng: lang, fallbackLng: false, defaultValue: lang }),
            completeness: completeness,
        }
    })
}

/**
 * Change the current language
 * @param {string} language - Language code
 */
export const changeLanguage = async (language) => {
    localStorage.setItem("i18nextLng", language)
}

/**
 * Get current language
 * @returns {string}
 */
export const getCurrentLanguage = () => {
    const from_local_storage = localStorage.getItem("i18nextLng")
    const from_navigator = navigator.languages

    const to_search = [from_local_storage, ...from_navigator]
    return getLanguage(to_search)
}

export const getWritingDirection = () => {
    return t("t_language_direction") === "rtl" ? "rtl" : "ltr"
}
const getLanguage = _.memoize((to_search) => {
    for (const lang of to_search) {
        if (lang != null) {
            const only_lang_region = (code) => {
                const loc = new Intl.Locale(code)
                return `${loc.language}-${loc.region}`
            }
            const only_lang = (code) => new Intl.Locale(code).language

            const available = [...Object.keys(resources)]

            let lr = available.find((x) => only_lang_region(x) == only_lang_region(lang))
            if (lr) return lr
            let l = available.find((x) => only_lang(x) == only_lang(lang))
            if (l) return l
        }
    }
    return "en"
}, JSON.stringify)

/**
 * Like t, but you can interpolate Preact elements.
 * @param {string} key
 * @param {Record<string, any>=} insertions
 * @returns {string | import("../imports/Preact.js").ReactElement}
 */
export const th = (key, insertions) => {
    const slot = (name) => `❊${name}⦿`

    const can_interpolate_directly = (value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean"

    const with_slots = t(key, {
        interpolation: { escapeValue: false },
        ...Object.fromEntries(Object.entries(insertions ?? {}).map(([key, value]) => [key, can_interpolate_directly(value) ? value : slot(key)])),
    })

    const slots = find_slots(with_slots)
    const slots_extended = [{ start: 0, end: 0, name: "" }, ...slots, { start: with_slots.length, end: with_slots.length, name: "" }]

    // The strings inbetween slots, including an initial and final string (possibly empty).
    const string_parts = slots_extended.slice(1).map((slot, i) => with_slots.slice(slots_extended[i].end, slot.start))

    // Objects to fill the slots with.
    const to_interpolate = slots.map((slot) => insertions?.[slot.name])

    const cache_key = [key, ...Object.keys(insertions ?? {})]
    return html(to_template_strings_array_cached(string_parts, cache_key), ...to_interpolate)
}

const find_slots = (/** @type {string} */ string) => {
    const matches = [...string.matchAll(/❊([^⦿]*?)⦿/g)]
    return matches.map((m) => ({
        start: m.index,
        end: m.index + m[0].length,
        name: m[1],
    }))
}

export const localized_list_htl = (elements, elements_strings, options) => {
    const keys = elements_strings.map((x) => x.toString())

    const list_format = new Intl.ListFormat(getCurrentLanguage(), options)
    const parts = list_format.formatToParts(keys)

    // Empty strings, everything is interpolated.
    const strings = Array(parts.length + 1).fill("")

    const interpolation_parts = parts.map((part) =>
        part.type === "element"
            ? // Find the matching element_string, and get the element with the same index.
              elements[keys.indexOf(part.value)]
            : // Literal string.
              part.value
    )

    return html(to_template_strings_array_cached(strings, parts.length), ...interpolation_parts)
}

/** @type {Map<string, TemplateStringsArray>} */
const template_strings_array_cache = new Map()
const to_template_strings_array_cached = (/** @type {string[]} */ strings, key) => {
    const key_string = JSON.stringify(key)
    const found = template_strings_array_cache.get(key_string)
    if (found) return found

    // @ts-ignore
    const result = /** @type {TemplateStringsArray} */ (strings)
    template_strings_array_cache.set(key_string, result) // @ts-ignore
    return result
}
