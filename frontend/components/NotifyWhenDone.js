import { html, useEffect, useState } from "../imports/Preact.js"

import { cl } from "../common/ClassTable.js"
import { is_finished, total_done } from "./StatusTab.js"
import { useDelayedTruth } from "./BottomRightPanel.js"
import { url_logo_small } from "./Editor.js"
import { open_pluto_popup } from "../common/open_pluto_popup.js"
import { getCurrentLanguage, t, th } from "../common/lang.js"
import { get_settings } from "./Settings.js"

const VERY_LONG_BUSY_THRESHOLD_SEC = 50

/**
 * @param {{
 * status: import("./Editor.js").StatusEntryData | null,
 * }} props
 */
export let NotifyWhenDone = ({ status }) => {
    if (!status) return null

    const all_done = Object.values(status.subtasks).every(is_finished)

    const [enabled, setEnabled] = useState(false)

    const automatically_enabled = get_settings().ALWAYS_NOTIFY_LONG_BUSY && useDelayedTruth(!all_done, VERY_LONG_BUSY_THRESHOLD_SEC * 1000)
    useEffect(() => {
        if (automatically_enabled) setEnabled(true)
    }, [automatically_enabled])

    useEffect(() => {
        if (enabled && all_done) {
            console.log("all done")

            /** @type {Notification?} */
            let notification = null

            let timeouthandler = setTimeout(() => {
                setEnabled(false)
                let count = total_done(status)
                notification = new Notification(t("t_ready_notif_title"), {
                    tag: "notebook ready",
                    body: t("t_ready_notif_body", { count }),
                    lang: getCurrentLanguage(),
                    dir: t("t_language_direction") === "rtl" ? "rtl" : "ltr",
                    icon: url_logo_small,
                })
                notification.onclick = () => {
                    parent.focus()
                    window.focus()
                    notification?.close()
                }
            }, 3000)

            const vishandler = () => {
                if (document.visibilityState === "visible") {
                    notification?.close()
                }
            }
            document.addEventListener("visibilitychange", vishandler)
            document.body.addEventListener("click", vishandler)

            return () => {
                notification?.close()

                clearTimeout(timeouthandler)
                document.removeEventListener("visibilitychange", vishandler)
                document.body.removeEventListener("click", vishandler)
            }
        }
    }, [all_done])

    const visible = useDelayedTruth(!all_done, 2500) || enabled

    return html`
        <div class=${cl({ visible, "notify-when-done": true })} inert=${!visible}>
            <label
                >${t("t_ready_notif")}
                <input
                    type="checkbox"
                    checked=${enabled}
                    disabled=${!visible}
                    onInput=${(e) => {
                        if (e.target.checked) {
                            get_notification_permission().then((granted) => {
                                setEnabled(granted)
                                e.target.checked = granted
                            })
                        } else {
                            setEnabled(false)
                        }
                    }}
            /></label>
        </div>
    `
}

export const get_notification_permission = () => {
    return Notification.requestPermission().then((r) => {
        console.log(r)
        const granted = r === "granted"

        if (!granted)
            open_pluto_popup({
                type: "warn",
                body: th("t_ready_notif_permission"),
            })

        return granted
    })
}
