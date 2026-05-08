import { cl } from "../common/ClassTable.js"
import { html, useEffect, useRef, useState } from "../imports/Preact.js"

export const DiscreteProgressBar = ({ onClick, total, done, busy, failed_indices }) => {
    total = Math.max(1, total)

    return html`
        <div
            class=${cl({
                "discrete-progress-bar": true,
                "small": total < 8,
                "mid": total >= 8 && total < 48,
                "big": total >= 48,
            })}
            data-total=${total}
            onClick=${onClick}
        >
            ${[...Array(total)].map((_, i) => {
                return html`<div
                    class=${cl({
                        done: i < done,
                        failed: failed_indices.includes(i),
                        busy: i >= done && i < done + busy,
                    })}
                ></div>`
            })}
        </div>
    `
}

export const DiscreteProgressBarTest = () => {
    const [done_total, set_done_total] = useState([0, 0, 0])

    const done_total_ref = useRef(done_total)
    done_total_ref.current = done_total

    useEffect(() => {
        let handle = setInterval(() => {
            const [done = 0, busy = 0, total = 0] = done_total_ref.current

            if (Math.random() < 0.3) {
                if (done < total) {
                    if (Math.random() < 0.1) {
                        set_done_total([done, 1, total + 5])
                    } else {
                        set_done_total([done + 1, 1, total])
                    }
                } else {
                    set_done_total([0, 1, Math.ceil(Math.random() * Math.random() * 100)])
                }
            }
        }, 100)
        return () => clearInterval(handle)
    }, [])

    return html`<${DiscreteProgressBar} total=${done_total[2]} busy=${done_total[1]} done=${done_total[0]} />`
}
