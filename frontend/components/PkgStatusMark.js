import { t, th } from "../common/lang.js"
import { open_pluto_popup } from "../common/open_pluto_popup.js"
import _ from "../imports/lodash.js"
import { html, useEffect, useState } from "../imports/Preact.js"
import { InlineIonicon } from "./PlutoLandUpload.js"

export const nbpkg_fingerprint = (nbpkg) => (nbpkg == null ? [null] : Object.entries(nbpkg).flat())

export const nbpkg_fingerprint_without_terminal = (nbpkg) =>
    nbpkg == null ? [null] : Object.entries(nbpkg).flatMap(([k, v]) => (k === "terminal_outputs" ? [] : [v]))

const can_update = (installed, available) => {
    if (installed === "stdlib" || !_.isArray(available)) {
        return false
    } else {
        // return true
        return _.last(available) !== installed
    }
}

/**
 * @typedef PackageStatus
 * @property {string} status
 * @property {import("../imports/Preact.js").ReactElement} hint
 * @property {string} hint_raw
 * @property {string[]?} available_versions
 * @property {string?} chosen_version
 * @property {string?} package_url
 * @property {boolean} busy
 * @property {boolean} offer_update
 */

/**
 * @param {{
 *  package_name: string,
 *  package_url?: string,
 *  is_disable_pkg: boolean,
 *  available_versions?: string[],
 *  nbpkg: import("./Editor.js").NotebookPkgData?,
 * }} props
 * @returns {PackageStatus}
 */
export const package_status = ({ nbpkg, package_name, available_versions, is_disable_pkg, package_url }) => {
    let status = "error"
    let hint_raw = "error"
    let hint = html`error`
    let offer_update = false

    package_url = package_url ?? `https://juliahub.com/ui/Packages/General/${package_name}`

    let chosen_version = nbpkg?.installed_versions[package_name] ?? null
    if (chosen_version === "nothing") chosen_version = "..."
    const nbpkg_waiting_for_permission = nbpkg?.waiting_for_permission ?? false
    const busy = !nbpkg_waiting_for_permission && ((nbpkg?.busy_packages ?? []).includes(package_name) || !(nbpkg?.instantiated ?? true))

    const package_name_pretty = html`<a class="package-name" href=${package_url}><b>${package_name}</b></a> `

    const nbsp = "\u00A0"
    const edit = html`${nbsp}<a
            href="#"
            title="Edit package versions"
            class="edit_package_version"
            onClick=${(e) => {
                window.dispatchEvent(new CustomEvent("open pluto project toml editor"))
                e.preventDefault()
            }}
        >
            ${InlineIonicon("build-outline")}
        </a>`

    if (is_disable_pkg) {
        const f_name = package_name
        status = "disable_pkg"
        hint_raw = t("t_pkg_disables_str", { function: f_name })
        hint = th("t_pkg_disables_str", { function: html`<b>${f_name}</b>` })
    } else if (chosen_version != null || _.isEqual(available_versions, ["stdlib"])) {
        if (chosen_version == null || chosen_version === "stdlib") {
            status = "installed"
            hint_raw = t("t_pkg_stdlib", { package: package_name }).replaceAll(/<\/?em>/g, "'")
            hint = th("t_pkg_stdlib", { package: package_name_pretty })
        } else {
            if (nbpkg_waiting_for_permission) {
                status = "will_be_installed"

                hint_raw = t("t_pkg_will_be_installed", { package: `${package_name} (v${_.last(available_versions)})` })
                hint = th("t_pkg_will_be_installed", {
                    package: html`<header>${package_name_pretty} <pkg-version>v${_.last(available_versions)}${edit}</pkg-version></header>`,
                })
            } else if (busy) {
                status = "busy"

                hint_raw = t("t_pkg_is_installing", { package: `${package_name} (v${chosen_version})` })
                hint = th("t_pkg_is_installing", {
                    package: html`<header>${package_name_pretty}${" "}<pkg-version>v${chosen_version}${edit}</pkg-version></header>`,
                })
            } else {
                status = "installed"

                hint_raw = t("t_pkg_is_installed", { package: `${package_name} (v${chosen_version})` })
                hint = th("t_pkg_is_installed", {
                    package: html`<header>${package_name_pretty}${" "}<pkg-version>v${chosen_version}${edit}</pkg-version></header>`,
                })

                offer_update = can_update(chosen_version, available_versions)
            }
        }
    } else {
        if (available_versions != null && _.isArray(available_versions)) {
            if (available_versions.length === 0) {
                status = "not_found"

                hint_raw = t("t_pkg_not_found", { package: `"${package_name}"` })
                hint = th("t_pkg_not_found", {
                    package: html`<em>"${package_name}"</em>`,
                })
            } else {
                status = "will_be_installed"

                hint_raw = t("t_pkg_will_be_installed_in_notebook", { package: `${package_name} (v${_.last(available_versions)})` })

                hint = th("t_pkg_will_be_installed_in_notebook", {
                    package: html`<header>${package_name_pretty} <pkg-version>v${_.last(available_versions)}${edit}</pkg-version></header>`,
                })
            }
        }
    }

    return { status, hint, hint_raw, available_versions: available_versions ?? null, chosen_version, busy, offer_update, package_url }
}

/**
 * The little icon that appears inline next to a package import in code (e.g. `using PlutoUI ✅`)
 * @param {{
 *  package_name: string,
 *  pluto_actions: any,
 *  notebook_id: string,
 *  nbpkg: import("./Editor.js").NotebookPkgData?,
 * }} props
 */
export const PkgStatusMark = ({ package_name, pluto_actions, notebook_id, nbpkg }) => {
    const [available_versions_msg, set_available_versions_msg] = useState(/** @type {{ versions?: string[], package_url?: string }?} */ (null))
    const [package_url, set_package_url] = useState(/** @type {string[]?} */ (null))

    useEffect(() => {
        let available_version_promise = pluto_actions.get_avaible_versions({ package_name, notebook_id }) ?? Promise.resolve([])
        available_version_promise.then(set_available_versions_msg)
    }, [package_name])

    const { status, hint_raw } = package_status({
        nbpkg: nbpkg,
        package_name: package_name,
        is_disable_pkg: false,
        available_versions: available_versions_msg?.versions,
        package_url: available_versions_msg?.package_url,
    })

    return html`
        <pkg-status-mark
            title=${hint_raw}
            className=${status === "busy"
                ? "busy"
                : status === "installed"
                  ? "installed"
                  : status === "not_found"
                    ? "not_found"
                    : status === "will_be_installed"
                      ? "will_be_installed"
                      : ""}
        >
            <button
                onClick=${(event) => {
                    open_pluto_popup({
                        type: "nbpkg",
                        source_element: event.currentTarget.parentElement,
                        package_name: package_name,
                        is_disable_pkg: false,
                        should_focus: true,
                    })
                }}
            >
                <span></span>
            </button>
        </pkg-status-mark>
    `
}

export const PkgActivateMark = ({ package_name }) => {
    const { hint_raw } = package_status({
        nbpkg: null,
        package_name: package_name,
        is_disable_pkg: true,
    })

    return html`
        <pkg-status-mark title=${hint_raw} class="disable_pkg">
            <button
                onClick=${(event) => {
                    open_pluto_popup({
                        type: "nbpkg",
                        source_element: event.currentTarget.parentElement,
                        package_name: package_name,
                        is_disable_pkg: true,
                        should_focus: true,
                    })
                }}
            >
                <span></span>
            </button>
        </pkg-status-mark>
    `
}
