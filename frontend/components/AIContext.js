import _ from "../imports/lodash-es.js"
import { html, useState, useRef, useContext } from "../imports/Preact.js"

import { cl } from "../common/ClassTable.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"
import { useEventListener } from "../common/useEventListener.js"
import { upstream_recursive } from "../common/SliderServerClient.js"
import { t } from "../common/lang.js"

const format_code = (s) =>
    s == null
        ? ""
        : `<julia-code-block>
${s}
</julia-code-block>`

const format_cell_output = (/** @type {import("./Editor.js").CellResultData | undefined} */ cell_result, /** @type {number} */ truncate_limit) => {
    const text = cell_output_to_plaintext(cell_result, truncate_limit)

    return text == null
        ? ""
        : `<pluto-ai-context-cell-output errored="${cell_result?.errored ?? "false"}">
${text === "" || text == null ? "nothing" : text}
</pluto-ai-context-cell-output>`
}

const packages_context = (/** @type {import("./Editor.js").NotebookData} */ notebook) => {
    const has_nbpkg = notebook.nbpkg?.enabled === true
    const installed = Object.keys(notebook.nbpkg?.installed_versions ?? {})

    return !has_nbpkg
        ? ""
        : `
<pluto-ai-context-packages>
The following packages are currently installed in this notebook: ${installed.join(", ")}.
</pluto-ai-context-packages>`
}

export const AIContext = ({ cell_id, current_code }) => {
    const pluto_actions = useContext(PlutoActionsContext)
    const [copied, setCopied] = useState(false)

    const notebook = /** @type{import("./Editor.js").NotebookData} */ (pluto_actions.get_notebook())

    const default_question = notebook.cell_results[cell_id]?.errored === true ? t("t_ai_prompt_generator_default_question_errored") : ""
    const [userQuestion, setUserQuestion] = useState(default_question)

    const recursive = true

    const prompt_args = {
        userQuestion,
        recursive,
        notebook,
        cell_id,
        current_code,
    }
    let prompt = generate_prompt(prompt_args)
    let prompt_tokens = count_openai_tokens(prompt)
    if (prompt_tokens > 3000) {
        console.log("Prompt is too long, truncating...", prompt, prompt_tokens)
        prompt = generate_prompt({
            ...prompt_args,
            recursive: false,
            truncate_limit_current_cell: 1000,
        })
        prompt_tokens = count_openai_tokens(prompt)
    }

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(prompt)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy text:", err)
        }
    }

    const formRef = useRef(null)
    useEventListener(formRef, "submit", (e) => {
        e.preventDefault()
        copyToClipboard()
    })

    return html`
        <form class="ai-context-container" ref=${formRef}>
            <h2>${t("t_ai_prompt_generator_title")} <em style="font-size: 0.8em; opacity: .7;">(beta)</em></h2>
            <p class="ai-context-intro">${t("t_ai_prompt_generator_intro")}</p>
            <input
                type="text"
                name="pluto-ai-context-question"
                class="ai-context-question-input"
                placeholder=${t("t_ai_prompt_generator_question_input_placeholder")}
                autocomplete="off"
                value=${userQuestion}
                onInput=${(e) => setUserQuestion(e.target.value)}
            />
            <div class="ai-context-prompt-container">
                <button
                    class=${cl({
                        "copy-button": true,
                        "copied": copied,
                    })}
                    type="submit"
                    title=${t("t_copy_action_description")}
                >
                    ${copied ? t("t_copy_action_complete") : t("t_copy_action")}
                </button>
                <div
                    class=${cl({
                        "ai-context-prompt": true,
                        "ai-context-prompt-with-question": userQuestion.length > 0,
                    })}
                >
                    <pre>${prompt.trim()}</pre>
                </div>
            </div>
        </form>
    `
}

/**
 * @param {{
 *     userQuestion: string,
 *     recursive: boolean,
 *     notebook: import("./Editor.js").NotebookData,
 *     cell_id: string,
 *     current_code: string,
 *     truncate_limit_current_cell?: number,
 * }} props
 * @returns {string}
 */
const generate_prompt = ({ userQuestion, recursive, notebook, cell_id, current_code, truncate_limit_current_cell = 800 }) => {
    const current_cell = `
<pluto-ai-context-current-cell>
The current cell has the following code:

${format_code(current_code)}

${format_cell_output(notebook.cell_results[cell_id], truncate_limit_current_cell)}
</pluto-ai-context-current-cell>
`

    const graph = notebook.cell_dependencies

    // Get the list of upstream cells, in the order that they appear in the notebook.
    const upstream_cellids = upstream_recursive(graph, [cell_id], { recursive })
    const upstream_cells = notebook.cell_order.filter((cid) => upstream_cellids.has(cid))

    // Get the variables that are used in the current cell, which are defined in other cells.
    const upstream_direct = notebook.cell_dependencies[cell_id]?.upstream_cells_map ?? {}
    const variables_used_from_upstream = Object.entries(upstream_direct)
        .filter(([_var, upstream_cell_ids]) => upstream_cell_ids.length > 0)
        .map(([variable]) => variable)

    const variable_context = `
<pluto-ai-context-variables>
The current cell uses the following variables from other cells: ${variables_used_from_upstream.join(", ")}.

These variables are defined in the following cells:

${upstream_cells.map((cid) => format_code(notebook.cell_inputs[cid]?.code)).join("\n\n")}
</pluto-ai-context-variables>
`

    const prompt = `${userQuestion}

<pluto-ai-context>
To help me answer my question, here is some auto-generated context. The code is from a Pluto Julia notebook. We are concerned with one specific cell in the notebook, called "the current cell". And you will get additional context.

When suggesting new code, give each cell its own code block, and keep global variables names as they are.

${current_cell}

${upstream_cells.length > 0 ? variable_context : ""}

${packages_context(notebook)}
</pluto-ai-context>
`

    return prompt
}

const cell_output_to_plaintext = (/** @type {import("./Editor.js").CellResultData | undefined} */ cell_result, /** @type {number} */ truncate_limit) => {
    if (cell_result == null) return null

    const cell_output = cell_result.output
    if (cell_output.mime === "text/plain") {
        return cell_output.body
    }
    if (cell_output.mime === "application/vnd.pluto.stacktrace+object") {
        return cell_output.body.plain_error
    }
    if (cell_output.mime.includes("image")) return "<!-- Image -->"

    if (cell_output.mime === "text/html") {
        try {
            return JSON.stringify(cell_result, (key, value) => {
                if (typeof value === "string" && value.length > truncate_limit) {
                    return (
                        value.substring(0, truncate_limit / 2) +
                        `... <!-- ${value.length - truncate_limit / 2 - 20} CHARACTERS TRUNCATED --> ... ` +
                        value.substring(value.length - 20)
                    )
                }
                return value
            })
        } catch (e) {
            return "<!-- HTML content that couldn't be stringified -->"
        }
    }

    return JSON.stringify(cell_output)
}

/** Rough heuristic for counting tokens in a string. */
const count_openai_tokens = (text) => {
    const num_seps = text.match(/[^\p{L}]+/gmu)?.length ?? 0
    const val1 = num_seps * 2.3

    const val2 = text.length * 0.29

    // Average
    return (val1 + val2) / 2
}
