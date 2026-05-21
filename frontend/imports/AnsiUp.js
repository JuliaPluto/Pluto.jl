// @ts-ignore
import { AnsiUp } from "https://cdn.jsdelivr.net/npm/ansi_up@6.0.6/+esm"

export const ansi_to_html = (ansi, { use_classes = true } = {}) => {
    const ansi_up = new AnsiUp()
    ansi_up.use_classes = use_classes
    return ansi_up.ansi_to_html(ansi)
}
