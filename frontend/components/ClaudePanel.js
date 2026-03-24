import { html, Component, useContext, useState, useRef, useEffect, useCallback } from "../imports/Preact.js"
import { PlutoActionsContext } from "../common/PlutoContext.js"

// ─── helpers ────────────────────────────────────────────────────────────────

/** Extract ```julia ... ``` (or ``` ... ```) fenced code blocks from a markdown string.
 *  Returns an array of { lang, code } objects.
 */
function extract_code_blocks(text) {
    const blocks = []
    const re = /```(julia|jl|)?\n([\s\S]*?)```/g
    let m
    while ((m = re.exec(text)) !== null) {
        blocks.push({ lang: m[1] || "julia", code: m[2].trim() })
    }
    return blocks
}

/** Call the /api/claude backend endpoint. */
async function call_claude({ prompt, model, system_prompt, notebook_id }) {
    const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, system_prompt, notebook_id }),
    })
    const data = await resp.json()
    if (!resp.ok || !data.success) throw new Error(data.error ?? `HTTP ${resp.status}`)
    return data.response
}

// ─── component ──────────────────────────────────────────────────────────────

export function ClaudePanel({ open, onClose, notebook_id, notebook_cell_order }) {
    const pluto_actions = useContext(PlutoActionsContext)

    const [model, set_model] = useState("claude-sonnet-4-6")
    const [system_prompt, set_system_prompt] = useState("")
    const [prompt, set_prompt] = useState("")
    const [response, set_response] = useState(null)
    const [loading, set_loading] = useState(false)
    const [error, set_error] = useState(null)

    const prompt_ref = useRef(null)

    // Focus prompt input when panel opens
    useEffect(() => {
        if (open && prompt_ref.current) prompt_ref.current.focus()
    }, [open])

    const handle_submit = useCallback(async () => {
        if (!prompt.trim() || loading) return
        set_loading(true)
        set_error(null)
        set_response(null)
        try {
            const text = await call_claude({ prompt, model, system_prompt, notebook_id })
            set_response(text)
        } catch (e) {
            set_error(e.message)
        } finally {
            set_loading(false)
        }
    }, [prompt, model, system_prompt, notebook_id, loading])

    const handle_key = useCallback(
        (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault()
                handle_submit()
            }
            if (e.key === "Escape") onClose()
        },
        [handle_submit, onClose]
    )

    const insert_cell = useCallback(
        async (code) => {
            // Insert after the last cell, or at position 0 if empty
            const index = notebook_cell_order ? notebook_cell_order.length : 0
            await pluto_actions.add_remote_cell_at(index, code)
        },
        [pluto_actions, notebook_cell_order]
    )

    const insert_all_cells = useCallback(
        async (blocks) => {
            const start = notebook_cell_order ? notebook_cell_order.length : 0
            for (let i = 0; i < blocks.length; i++) {
                await pluto_actions.add_remote_cell_at(start + i, blocks[i].code)
            }
        },
        [pluto_actions, notebook_cell_order]
    )

    if (!open) return null

    const code_blocks = response ? extract_code_blocks(response) : []
    // Plain text (non-code) portions of the response
    const plain_response = response ? response.replace(/```(julia|jl|)?\n[\s\S]*?```/g, "").trim() : ""

    return html`
        <div id="claude-panel-backdrop" onClick=${(e) => e.target.id === "claude-panel-backdrop" && onClose()}>
            <div id="claude-panel">
                <div id="claude-panel-header">
                    <span id="claude-panel-title">
                        <img src="https://www.anthropic.com/favicon.ico" width="16" height="16" style="vertical-align:middle;margin-right:6px" onerror="this.style.display='none'" />
                        Ask Claude
                    </span>
                    <button id="claude-panel-close" onClick=${onClose} title="Close (Esc)">✕</button>
                </div>

                <div id="claude-panel-body">
                    <!-- Model selector -->
                    <div class="claude-row">
                        <label>Model</label>
                        <select value=${model} onChange=${(e) => set_model(e.target.value)}>
                            <option value="claude-opus-4-6">Opus 4.6 — most capable</option>
                            <option value="claude-sonnet-4-6">Sonnet 4.6 — fast + smart</option>
                            <option value="claude-haiku-4-5">Haiku 4.5 — fastest</option>
                        </select>
                    </div>

                    <!-- System prompt (collapsible) -->
                    <details class="claude-row">
                        <summary>System prompt <span style="opacity:0.5;font-size:0.85em">(optional)</span></summary>
                        <textarea
                            class="claude-textarea"
                            rows="2"
                            placeholder="You are a helpful Julia scientific computing assistant."
                            value=${system_prompt}
                            onInput=${(e) => set_system_prompt(e.target.value)}
                        ></textarea>
                    </details>

                    <!-- Prompt input -->
                    <textarea
                        ref=${prompt_ref}
                        id="claude-prompt-input"
                        class="claude-textarea"
                        rows="4"
                        placeholder="Ask Claude to write Julia code…&#10;&#10;Tip: Ctrl+Enter to send"
                        value=${prompt}
                        onInput=${(e) => set_prompt(e.target.value)}
                        onKeyDown=${handle_key}
                    ></textarea>

                    <div class="claude-row claude-actions">
                        <button
                            id="claude-send-btn"
                            onClick=${handle_submit}
                            disabled=${loading || !prompt.trim()}
                        >
                            ${loading ? html`<span class="claude-spinner"></span> Thinking…` : "▶ Send  (⌘↵)"}
                        </button>
                        ${response
                            ? html`<button class="claude-clear-btn" onClick=${() => { set_response(null); set_error(null) }}>Clear</button>`
                            : null}
                    </div>

                    <!-- Error -->
                    ${error
                        ? html`<div class="claude-error">
                              <strong>Error:</strong> ${error}
                          </div>`
                        : null}

                    <!-- Response -->
                    ${response
                        ? html`<div id="claude-response">
                              ${plain_response
                                  ? html`<div class="claude-response-text">${plain_response}</div>`
                                  : null}

                              ${code_blocks.length > 0
                                  ? html`
                                        <div class="claude-code-blocks-header">
                                            <span>${code_blocks.length} code block${code_blocks.length > 1 ? "s" : ""}</span>
                                            ${code_blocks.length > 1
                                                ? html`<button class="claude-insert-all-btn" onClick=${() => insert_all_cells(code_blocks)}>
                                                      ↓ Insert all ${code_blocks.length} cells
                                                  </button>`
                                                : null}
                                        </div>
                                        ${code_blocks.map(
                                            ({ code }, i) => html`
                                                <div class="claude-code-block">
                                                    <div class="claude-code-block-toolbar">
                                                        <span class="claude-code-block-label">Cell ${i + 1}</span>
                                                        <button class="claude-insert-btn" onClick=${() => insert_cell(code)}>
                                                            ↓ Insert cell
                                                        </button>
                                                    </div>
                                                    <pre class="claude-code"><code>${code}</code></pre>
                                                </div>
                                            `
                                        )}
                                    `
                                  : html`<div class="claude-no-code">No Julia code blocks found. Copy the text above manually.</div>`}
                          </div>`
                        : null}
                </div>
            </div>
        </div>
    `
}

// ─── styles ─────────────────────────────────────────────────────────────────

const CLAUDE_STYLES = `
#claude-panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    z-index: 10000;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 60px 16px 16px;
}

#claude-panel {
    background: var(--background-color, #fff);
    border: 1.5px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    width: min(520px, 96vw);
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--font-family, inherit);
}

#claude-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    background: var(--header-bg, #f8f8f8);
    flex-shrink: 0;
}

#claude-panel-title {
    font-weight: 600;
    font-size: 0.95em;
    color: var(--pluto-output-color, #333);
}

#claude-panel-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1em;
    color: #888;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
}
#claude-panel-close:hover { background: var(--hover-color, #eee); color: #333; }

#claude-panel-body {
    padding: 14px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.claude-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.claude-row label { font-size: 0.85em; font-weight: 500; white-space: nowrap; }
.claude-row select {
    flex: 1;
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid var(--border-color, #ccc);
    background: var(--input-bg, #fff);
    font-size: 0.9em;
}
details.claude-row { flex-direction: column; align-items: stretch; }
details.claude-row summary {
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 500;
    user-select: none;
    padding: 2px 0;
}

.claude-textarea {
    width: 100%;
    resize: vertical;
    border: 1.5px solid var(--border-color, #ccc);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 0.9em;
    font-family: inherit;
    background: var(--input-bg, #fff);
    color: var(--pluto-output-color, #333);
    box-sizing: border-box;
    transition: border-color 0.15s;
}
.claude-textarea:focus {
    outline: none;
    border-color: #cf8b4e;
}

#claude-prompt-input { min-height: 80px; }

.claude-actions { justify-content: flex-start; gap: 8px; }

#claude-send-btn {
    padding: 7px 18px;
    background: #cf8b4e;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s;
}
#claude-send-btn:hover:not(:disabled) { background: #b87740; }
#claude-send-btn:disabled { opacity: 0.55; cursor: default; }

.claude-clear-btn {
    padding: 7px 14px;
    background: none;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 6px;
    font-size: 0.9em;
    cursor: pointer;
    color: var(--pluto-output-color, #555);
}
.claude-clear-btn:hover { background: var(--hover-color, #eee); }

.claude-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: claude-spin 0.7s linear infinite;
}
@keyframes claude-spin { to { transform: rotate(360deg); } }

.claude-error {
    padding: 10px 12px;
    background: #fff0f0;
    border: 1px solid #ffaaaa;
    border-radius: 6px;
    color: #c0392b;
    font-size: 0.88em;
}

#claude-response { display: flex; flex-direction: column; gap: 8px; }

.claude-response-text {
    font-size: 0.88em;
    color: var(--pluto-output-color, #555);
    white-space: pre-wrap;
    background: var(--secondary-bg, #f5f5f5);
    border-radius: 6px;
    padding: 8px 10px;
    max-height: 140px;
    overflow-y: auto;
}

.claude-code-blocks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82em;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.claude-insert-all-btn {
    padding: 4px 12px;
    background: #cf8b4e;
    color: #fff;
    border: none;
    border-radius: 5px;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
}
.claude-insert-all-btn:hover { background: #b87740; }

.claude-code-block {
    border: 1.5px solid var(--border-color, #ddd);
    border-radius: 7px;
    overflow: hidden;
}

.claude-code-block-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 10px;
    background: var(--secondary-bg, #f5f5f5);
    border-bottom: 1px solid var(--border-color, #ddd);
}
.claude-code-block-label { font-size: 0.8em; color: #888; font-weight: 600; }

.claude-insert-btn {
    padding: 3px 10px;
    background: #cf8b4e;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 0.82em;
    font-weight: 600;
    cursor: pointer;
}
.claude-insert-btn:hover { background: #b87740; }

.claude-code {
    margin: 0;
    padding: 10px 12px;
    font-size: 0.82em;
    background: var(--code-bg, #fafafa);
    overflow-x: auto;
    white-space: pre;
    font-family: "JuliaMono", "Cascadia Code", "Fira Code", monospace;
    max-height: 220px;
    overflow-y: auto;
}

.claude-no-code {
    font-size: 0.85em;
    color: #888;
    font-style: italic;
    padding: 6px 0;
}

/* Toolbar button in the header nav */
#claude-nav-btn {
    background: none;
    border: 1.5px solid transparent;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 600;
    color: var(--pluto-output-color, #555);
    display: flex;
    align-items: center;
    gap: 5px;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
}
#claude-nav-btn:hover {
    background: var(--hover-color, rgba(0,0,0,0.05));
    border-color: var(--border-color, #ccc);
}
#claude-nav-btn.active {
    background: #cf8b4e22;
    border-color: #cf8b4e;
    color: #cf8b4e;
}
`

// Inject styles once
if (!document.getElementById("claude-panel-styles")) {
    const style = document.createElement("style")
    style.id = "claude-panel-styles"
    style.textContent = CLAUDE_STYLES
    document.head.appendChild(style)
}
