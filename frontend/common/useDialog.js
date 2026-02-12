//@ts-ignore
import dialogPolyfill from "https://cdn.jsdelivr.net/npm/dialog-polyfill@0.5.6/dist/dialog-polyfill.esm.min.js"

import { useLayoutEffect, useMemo, useRef, useState } from "../imports/Preact.js"
import { useEventListener } from "./useEventListener.js"

/**
 * @returns {[import("../imports/Preact.js").Ref<HTMLDialogElement?>, () => void, () => void, () => void, boolean]}
 */
export const useDialog = () => {
    const dialog_ref = useRef(/** @type {HTMLDialogElement?} */ (null))
    const [currently_open, set_currently_open] = useState(false)

    useLayoutEffect(() => {
        if (dialog_ref.current != null && typeof HTMLDialogElement !== "function") dialogPolyfill.registerDialog(dialog_ref.current)

        set_currently_open(dialog_ref.current?.open ?? false)
    }, [dialog_ref.current, set_currently_open])

    useEventListener(
        dialog_ref.current,
        "close",
        () => {
            set_currently_open(dialog_ref.current?.open ?? false)
        },
        [set_currently_open]
    )

    useEventListener(
        dialog_ref.current,
        "toggle",
        () => {
            set_currently_open(dialog_ref.current?.open ?? false)
        },
        [set_currently_open]
    )

    const { open, close, toggle } = useMemo(() => {
        const open = () => {
            if (!dialog_ref.current?.open) {
                dialog_ref.current?.showModal()
                requestAnimationFrame(() => {
                    dialog_ref.current?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" })
                })
                set_currently_open(true)
            }
        }
        const close = () => {
            if (dialog_ref.current?.open === true) dialog_ref.current?.close?.()
        }
        const toggle = () => (dialog_ref.current?.open === true ? dialog_ref.current?.close?.() : dialog_ref.current?.showModal?.())

        return { open, close, toggle }
    }, [dialog_ref])

    return [dialog_ref, open, close, toggle, currently_open]
}
