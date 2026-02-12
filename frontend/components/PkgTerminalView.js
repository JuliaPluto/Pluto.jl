import { useDialog } from "../common/useDialog.js"
import { useEventListener } from "../common/useEventListener.js"
import { ansi_to_html } from "../imports/AnsiUp.js"
import { html, Component, useState, useEffect, useRef, useLayoutEffect } from "../imports/Preact.js"

export const IoniconButton = ({ icon, ...kwargs }) => {
    return html`<button ...${kwargs} data-icon=${icon} class="ionicon-icon-button"></button>`
}

const make_spinner_spin = (original_html) => original_html.replaceAll("◐", `<span class="make-me-spin">◐</span>`)

const TerminalViewAnsiUp = ({ value, hide_button = false }) => {
    const node_ref = useRef(/** @type {HTMLElement?} */ (null))

    const start_time = useRef(Date.now())

    useEffect(() => {
        if (!node_ref.current) return
        node_ref.current.style.cssText = `--animation-delay: -${(Date.now() - start_time.current) % 1000}ms`
        node_ref.current.innerHTML = make_spinner_spin(ansi_to_html(value))
        const parent = node_ref.current.parentElement
        if (parent) parent.scrollTop = 1e5
    }, [node_ref.current, value])

    const button = hide_button
        ? null
        : html`<button
              onclick=${() => window.dispatchEvent(new CustomEvent("open big pkg terminal", { detail: { package_name: "nbpkg_sync" } }))}
              class="open-big-terminal"
              title="Open in full screen"
          ></button>`

    return !!value
        ? html`<pkg-terminal dir="ltr"
              >${button}
              <div class="scroller" tabindex="0"><pre ref=${node_ref} class="pkg-terminal"></pre></div
          ></pkg-terminal>`
        : null
}

export const PkgTerminalView = TerminalViewAnsiUp

export const BigPkgTerminal = ({ notebook }) => {
    const [current_package_name, set_current_package_name] = useState("nbpkg_sync")

    const [dialog_ref, open, close, _toggle] = useDialog()

    useEventListener(
        window,
        "open big pkg terminal",
        (e) => {
            set_current_package_name(e.detail.package_name ?? "nbpkg_sync")
            open()
        },
        [open, set_current_package_name]
    )

    //  TODO: effect on close, clear the current package name

    return html`
        <dialog class="big-pkg-terminal" ref=${dialog_ref}>
            <div>
                <${PkgTerminalView} value=${notebook?.nbpkg?.terminal_outputs?.[current_package_name] ?? "Loading..."} hide_button=${true} />
                <button onclick=${close} class="close-big-terminal">Close</button>
            </div>
        </dialog>
    `
}
