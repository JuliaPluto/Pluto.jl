import { html, useEffect, useState, useContext, useRef, useMemo } from "../imports/Preact.js"
import { cl } from "../common/ClassTable.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { is_mac_keyboard } from "../common/KeyboardShortcuts.js"
import { t, th } from "../common/lang.js"

const nbsp = "\u00A0"
const await_focus = () =>
    document.visibilityState === "visible"
        ? Promise.resolve()
        : new Promise((res) => {
              const h = () => {
                  await_focus().then(res)
                  document.removeEventListener("visibilitychange", h)
              }
              document.addEventListener("visibilitychange", h)
          })

export const Preamble = ({ any_code_differs, last_update_time, last_hot_reload_time, connected }) => {
    let pluto_actions = useContext(PlutoActionsContext)

    const [state, set_state] = useState("")
    const [reload_state, set_reload_state] = useState("")
    const timeout_ref = useRef(/** @type {number?} */ (null))
    const reload_timeout_ref = useRef(/** @type {number?} */ (null))
    const clear_timeout = (x) => x && clearTimeout(x)

    useEffect(() => {
        clear_timeout(timeout_ref?.current)
        if (any_code_differs) {
            set_state("ask_to_save")
        } else {
            if (Date.now() - last_update_time < 1000) {
                set_state("saved")
                timeout_ref.current = setTimeout(() => {
                    set_state("")
                }, 1000)
            } else {
                set_state("")
            }
        }
        return () => clear_timeout(timeout_ref?.current)
    }, [any_code_differs])

    // silly bits to not show "Reloaded from file" immediately
    const [old_enough, set_old_enough] = useState(false)
    useEffect(() => {
        if (connected) {
            setTimeout(() => set_old_enough(true), 1000)
        }
    }, [connected])

    useEffect(() => {
        console.log("Hottt", last_hot_reload_time, old_enough)
        if (old_enough) {
            set_reload_state("reloaded_from_file")
            console.log("set state")

            await_focus().then(() => {
                reload_timeout_ref.current = setTimeout(() => {
                    set_reload_state("")
                    console.log("reset state")
                }, 8000)
            })
            return () => clear_timeout(reload_timeout_ref?.current)
        }
    }, [last_hot_reload_time])

    return html`<preamble>
        ${state === "ask_to_save"
            ? html`
                  <div id="saveall-container" class="overlay-button ${state}">
                      <button
                          onClick=${() => {
                              set_state("saving")
                              pluto_actions.set_and_run_all_changed_remote_cells()
                          }}
                          class=${cl({ runallchanged: true })}
                          title=${t("t_save_all_changes_description")}
                      >
                          <span class="only-on-hover"><strong>${t("t_save_all_changes")}</strong>${nbsp}</span>${is_mac_keyboard
                              ? html`<kbd>⌘ S</kbd>`
                              : html`<kbd>Ctrl</kbd>+<kbd>S</kbd>`}
                      </button>
                  </div>
              `
            : // : state === "saving"
              // ? html` <div id="saveall-container" class="overlay-button ${state}">Saving... <span class="saving-icon"></span></div> `
              state === "saved" || state === "saving"
              ? html`
                    <div id="saveall-container" class="overlay-button ${state}">
                        <span><span class="only-on-hover">${t("t_file_saved")}${nbsp}</span><span class="saved-icon pluto-icon"></span></span>
                    </div>
                `
              : reload_state === "reloaded_from_file"
                ? html`
                      <div id="saveall-container" class="overlay-button ${state}">
                          <span>${th("t_file_change_detected")}${nbsp}<span class="saved-icon pluto-icon"></span></span>
                      </div>
                  `
                : null}
    </preamble>`
}
