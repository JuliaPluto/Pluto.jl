import _ from "../imports/lodash-es.js"
import { html, useContext, useEffect, useMemo, useState } from "../imports/Preact.js"

import { in_textarea_or_input } from "../common/KeyboardShortcuts.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { open_pluto_popup } from "../common/open_pluto_popup.js"
import { getCurrentLanguage, t, th } from "../common/lang.js"

export const RunArea = ({
    runtime,
    running,
    queued,
    code_differs,
    on_run,
    on_interrupt,
    set_cell_disabled,
    depends_on_disabled_cells,
    running_disabled,
    on_jump,
}) => {
    const on_save = on_run /* because disabled cells save without running */

    const local_time_running_ms = useMillisSinceTruthy(running)
    const local_time_running_ns = local_time_running_ms == null ? null : 1e6 * local_time_running_ms
    const pluto_actions = useContext(PlutoActionsContext)

    const action = running || queued ? "interrupt" : running_disabled ? "save" : depends_on_disabled_cells && !code_differs ? "jump" : "run"

    const fmap = {
        on_interrupt,
        on_save,
        on_jump,
        on_run,
    }

    const titlemap = {
        interrupt: t("t_interrupt_cell"),
        save: t("t_save_cell"),
        jump: t("t_jump_cell"),
        run: t("t_run_cell"),
    }

    const on_double_click = (/** @type {MouseEvent} */ e) => {
        if (running_disabled)
            open_pluto_popup({
                type: "info",
                source_element: /** @type {HTMLElement?} */ (e.target),
                body: th("t_cell_is_disabled", {
                    link: html`<a
                        href="#"
                        onClick=${(e) => {
                            //@ts-ignore
                            set_cell_disabled(false)

                            e.preventDefault()
                            window.dispatchEvent(new CustomEvent("close pluto popup"))
                        }}
                        >${t("t_cell_is_disabled_link")}</a
                    >`,
                }),
            })
    }

    return html`
        <pluto-runarea class=${action}>
            <button onDblClick=${on_double_click} onClick=${fmap[`on_${action}`]} class="runcell" title=${titlemap[action]}>
                <span></span>
            </button>
            <span class="runtime">${prettytime(running ? (local_time_running_ns ?? runtime) : runtime)}</span>
        </pluto-runarea>
    `
}

export const prettytime = (time_ns) => {
    if (time_ns == null) {
        return "---"
    }

    const units = ["nanosecond", "microsecond", "millisecond", "second"]
    const units_latin = ["ns", "μs", "ms", "sec"]

    // Find the right prefix
    let result = time_ns
    let i = 0
    while (i < units.length - 1 && result >= 1000.0) {
        i += 1
        result /= 1000
    }

    // Display the string
    const unit = units[i]
    return t("t_time_format_unit_override") === "latin"
        ? // Force latin unit (ms, ns)
          new Intl.NumberFormat(getCurrentLanguage(), {
              maximumFractionDigits: unit === "nanosecond" ? 0 : result < 100 ? 1 : 0,
          }).format(result) +
              "\xa0" +
              units_latin[i]
        : // Use localized unit
          new Intl.NumberFormat(getCurrentLanguage(), {
              style: "unit",
              unit,
              maximumFractionDigits: unit === "nanosecond" ? 0 : result < 100 ? 1 : 0,
          })
              .format(result)
              .replaceAll(" ", "\xa0")
}

const update_interval = 50
/**
 * Returns the milliseconds passed since the argument became truthy.
 * If argument is falsy, returns undefined.
 *
 * @param {boolean} truthy
 */
export const useMillisSinceTruthy = (truthy) => {
    const [now, setNow] = useState(0)
    const [startRunning, setStartRunning] = useState(0)
    useEffect(() => {
        let interval
        if (truthy) {
            const now = +new Date()
            setStartRunning(now)
            setNow(now)
            interval = setInterval(() => setNow(+new Date()), update_interval)
        }
        return () => {
            interval && clearInterval(interval)
        }
    }, [truthy])
    return truthy ? now - startRunning : undefined
}

export const useDebouncedTruth = (truthy, delay = 5) => {
    const [mytruth, setMyTruth] = useState(truthy)
    const setMyTruthAfterNSeconds = useMemo(() => _.debounce(setMyTruth, delay * 1000), [setMyTruth])
    useEffect(() => {
        if (truthy) {
            setMyTruth(true)
            setMyTruthAfterNSeconds.cancel()
        } else {
            setMyTruthAfterNSeconds(false)
        }
        return () => {}
    }, [truthy])
    return mytruth
}
