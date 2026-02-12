//@ts-ignore
import dialogPolyfill from "https://cdn.jsdelivr.net/npm/dialog-polyfill@0.5.6/dist/dialog-polyfill.esm.min.js"

import { useEventListener } from "../common/useEventListener.js"
import { html, useLayoutEffect, useRef } from "../imports/Preact.js"
import { getCurrentLanguage, t, th } from "../common/lang.js"
import * as desktop from "./DesktopInterface.js"
import { with_offline_bundle_query } from "./PlutoLandUpload.js"

const Circle = ({ fill }) => html`
    <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        style="
        height: .7em;
        width: .7em;
        margin-left: .3em;
        margin-right: .2em;
    "
    >
        <circle cx="24" cy="24" r="24" fill=${fill}></circle>
    </svg>
`
const Triangle = ({ fill }) => html`
    <svg width="48" height="48" viewBox="0 0 48 48" style="height: .7em; width: .7em; margin-left: .3em; margin-right: .2em; margin-bottom: -.1em;">
        <polygon points="24,0 48,40 0,40" fill=${fill} stroke="none" />
    </svg>
`
const Square = ({ fill }) => html`
    <svg width="48" height="48" viewBox="0 0 48 48" style="height: .7em; width: .7em; margin-left: .3em; margin-right: .2em; margin-bottom: -.1em;">
        <polygon points="0,0 0,40 40,40 40,0" fill=${fill} stroke="none" />
    </svg>
`

export const WarnForVisisblePasswords = () => {
    if (
        Array.from(document.querySelectorAll("bond")).some((bond_el) =>
            Array.from(bond_el.querySelectorAll(`input[type="password"]`)).some((input) => {
                // @ts-ignore
                if (input?.value !== "") {
                    input.scrollIntoView()
                    return true
                }
            })
        )
    ) {
        alert(
            // Super rare so no need for translation
            "Warning: this notebook includes a password input with something typed in it. The contents of this password field will be included in the exported file in an unsafe way. \n\nClear the password field and export again to avoid this problem."
        )
    }
}

export const exportNotebookDesktop = (
    /** @type {{ preventDefault: () => void; }} */ e,
    /** @type {Desktop.PlutoExport} */ type,
    /** @type {string} */ notebook_id
) => {
    if (desktop.is_desktop()) {
        e.preventDefault()
        desktop.export_notebook(notebook_id, type)
    }
}

export const ExportBanner = ({
    notebook_id,
    print_title,
    open,
    onClose,
    notebookfile_url,
    notebookexport_url,
    start_recording,
    process_waiting_for_permission,
}) => {
    //
    let print_old_title_ref = useRef("")
    useEventListener(
        window,
        "beforeprint",
        (e) => {
            if (!e.detail?.fake) {
                print_old_title_ref.current = document.title
                document.title = print_title.replace(/\.jl$/, "").replace(/\.plutojl$/, "")
            }
        },
        [print_title]
    )
    useEventListener(
        window,
        "afterprint",
        () => {
            document.title = print_old_title_ref.current
        },
        [print_title]
    )

    const element_ref = useRef(/** @type {HTMLDialogElement?} */ (null))

    useLayoutEffect(() => {
        if (element_ref.current != null && typeof HTMLDialogElement !== "function") dialogPolyfill.registerDialog(element_ref.current)
    }, [element_ref.current])

    useLayoutEffect(() => {
        // Closing doesn't play well if the browser is old and the dialog not open
        // https://github.com/GoogleChrome/dialog-polyfill/issues/149
        if (open) {
            element_ref.current?.open === false && element_ref.current?.show?.()
        } else {
            element_ref.current?.open && element_ref.current?.close?.()
        }
    }, [open, element_ref.current])

    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEventListener(
        element_ref.current,
        "focusout",
        () => {
            if (!element_ref.current?.matches(":focus-within")) onCloseRef.current()
        },
        []
    )
    const pride = true
    const prideMonth = new Date().getMonth() === 5

    const warn_if_safe_preview = () => (process_waiting_for_permission ? confirm(t("t_export_safe_preview_warning")) : true)

    return html`
        <dialog id="export" inert=${!open} open=${open} ref=${element_ref} class=${prideMonth ? "pride" : ""}>
            <div id="container">
                <div class="export_title">${t("t_export_category_export")}</div>
                <!-- no "download" attribute here: we want the jl contents to be shown in a new tab -->
                <a href=${notebookfile_url} target="_blank" class="export_card" onClick=${(e) => exportNotebookDesktop(e, 0, notebook_id)}>
                    <header role="none"><${Triangle} fill="#a270ba" /> ${t("t_export_card_notebook_file")}</header>
                    <section>${th("t_export_card_notebook_file_description")}</section>
                </a>
                <a
                    href=${notebookexport_url}
                    target="_blank"
                    class="export_card"
                    download=""
                    onClick=${(e) => {
                        if (!warn_if_safe_preview()) {
                            e.preventDefault()
                            return
                        }
                        e.preventDefault()
                        WarnForVisisblePasswords()
                        window.dispatchEvent(new CustomEvent("open pluto html export", { detail: { download_url: notebookexport_url } }))
                    }}
                >
                    <header role="none"><${Square} fill="#E86F51" /> ${t("t_export_card_static_html")}</header>
                    <section>${th("t_export_card_static_html_description")}</section>
                </a>
                <a
                    href="#"
                    class="export_card"
                    onClick=${(e) => {
                        if (!warn_if_safe_preview()) {
                            e.preventDefault()
                            return
                        }
                        window.print()
                    }}
                >
                    <header role="none"><${Square} fill="#619b3d" />${t("t_export_card_pdf")}</header>
                    <section>${th("t_export_card_pdf_description")}</section>
                </a>
                ${html`
                    <div class="export_title">${t("t_export_category_record")}</div>
                    <a
                        href="#"
                        onClick=${(e) => {
                            WarnForVisisblePasswords()
                            start_recording()
                            onClose()
                            e.preventDefault()
                        }}
                        class="export_card"
                        style=${getCurrentLanguage() === "el"
                            ? "--size: 26ch"
                            : getCurrentLanguage() === "de"
                              ? "--size: 24ch"
                              : getCurrentLanguage() === "pt-PT"
                                ? "--size: 26ch"
                                : null}
                    >
                        <header role="none"><${Circle} fill="#E86F51" />${th("t_export_card_record")}</header>
                        <section>${th("t_export_card_record_description")}</section>
                    </a>
                `}
                ${prideMonth
                    ? html`<div class="pride_message">
                          <p>${th("t_export_card_pride_month_message")}</p>
                      </div>`
                    : null}
            </div>
            <div class="export_small_btns">
                <button
                    title=${t("t_edit_frontmatter")}
                    class="toggle_frontmatter_edit"
                    onClick=${() => {
                        onClose()
                        window.dispatchEvent(new CustomEvent("open pluto frontmatter"))
                    }}
                >
                    <span></span>
                </button>
                <button
                    title=${t("t_start_presentation")}
                    class="toggle_presentation"
                    onClick=${() => {
                        onClose()
                        // @ts-ignore
                        window.present()
                    }}
                >
                    <span></span>
                </button>
                <button title=${t("t_close")} class="toggle_export" onClick=${() => onClose()}>
                    <span></span>
                </button>
            </div>
        </dialog>
    `
}
