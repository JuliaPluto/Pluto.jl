/**
 * @fileoverview client.js - Programmatic Interface for Pluto Notebooks
 *
 * This module provides a JavaScript API for interacting with Pluto notebooks
 * without requiring the full Editor UI. It's designed for:
 *
 * - Automated notebook execution
 * - Testing and CI/CD pipelines
 * - Custom notebook interfaces
 * - Headless Pluto workflows
 *
 * The API maintains compatibility with Pluto's internal state structures
 * and uses the same WebSocket protocol as the Editor.js component.
 *
 * ## Basic Usage
 *
 * ```javascript
 * import { Host } from '@plutojl/rainbow';
 *
 * // Connect to Pluto server
 * const host = new Host("http://localhost:1234");
 *
 * // Create a new notebook
 * const worker = await host.createWorker("x = 1 + 1");
 *
 * // Add and run cells
 * const cellId = await worker.addSnippet(0, "println(x)");
 *
 * // Listen for updates
 * worker.onUpdate((event) => {
 *   console.log("Update:", event.type, event.data);
 * });
 * ```
 *
 * ## State Compatibility
 *
 * The notebook state structure matches Editor.js exactly:
 * - `notebook_state.cell_order` - Array of cell IDs in execution order
 * - `notebook_state.cell_inputs` - Map of cell IDs to input data
 * - `notebook_state.cell_results` - Map of cell IDs to execution results
 * - `notebook_state.status_tree` - Execution status hierarchy
 *
 * @author Pluto.jl Team
 * @version 1.0.0
 */

import { create_pluto_connection, ws_address_from_base } from "../common/PlutoConnection.js"
import { ProcessStatus } from "../common/ProcessStatus.js"
import { applyPatches, produceWithPatches } from "../imports/immer.js"
import { getResult, getStatus, isTerminalStatus } from "./getters.js"

// vendored to drop unshakeable import
export const empty_notebook_state = ({ notebook_id }) => ({
    metadata: {},
    notebook_id: notebook_id,
    path: "",
    shortpath: "",
    in_temp_dir: true,
    process_status: ProcessStatus.starting,
    last_save_time: 0.0,
    last_hot_reload_time: 0.0,
    cell_inputs: {},
    cell_results: {},
    cell_dependencies: {},
    cell_order: [],
    cell_execution_order: [],
    published_objects: {},
    bonds: {},
    nbpkg: null,
    status_tree: null,
})

/**
 * @typedef CellData
 * @type {{
 *  input: import("../components/Editor.js").CellInputData,
 *  result: import("../components/Editor.js").CellResultData,
 * }}
 */

// Be sure to keep this in sync with DEFAULT_CELL_METADATA in Cell.jl
const DEFAULT_CELL_METADATA = {
    disabled: false,
    show_logs: true,
    skip_as_script: false,
}

// from our friends at https://stackoverflow.com/a/2117523
// i checked it and it generates Julia-legal UUIDs and that's all we need -SNOF
const uuidv4 = () =>
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16))

/**
 * Host - Main class for connecting to a Pluto server and managing notebooks
 *
 * This class provides high-level operations for interacting with a Pluto server:
 * - Discovering running notebooks
 * - Creating new notebooks from text content
 * - Managing Worker instances
 *
 * @example
 * const host = new Host("http://localhost:1234");
 * const workers = await host.workers();
 * const worker = await host.createWorker(``);
 */
export class Host {
    /**
     * Create a new Host instance
     * @param {string} [server_url="http://localhost:1234"] - Pluto server URL
     */
    constructor(server_url = "http://localhost:1234") {
        /** @type {string} */
        this.server_url = server_url
        /** @type {string} */
        this.ws_address = ws_address_from_base(server_url)
        /** @type {Map<string, Worker>} */
        this._notebooks = new Map()
    }

    /**
     * Get list of currently running notebooks on the server
     * @returns {Promise<Array<Worker>>} Array of worker information objects
     * @throws {Error} If connection to server fails
     */
    async workers() {
        try {
            // Create a temporary connection to get server info
            const temp_client = await create_pluto_connection({
                ws_address: this.ws_address,
                on_unrequested_update: () => {},
                on_connection_status: () => {},
                on_reconnect: async () => true,
            })

            // Request server status to get running notebooks
            const response = await temp_client.send("get_all_notebooks", {}, {}, false)
            temp_client.kill()

            return response.message?.notebooks || []
        } catch (error) {
            console.error("Failed to get running notebooks:", error)
            return []
        }
    }

    /**
     * Get or create a Worker instance for the given notebook ID
     *
     * This method implements a cache pattern - multiple calls with the same
     * notebook_id will return the same Worker instance.
     *
     * @param {string} notebook_id - Notebook UUID
     * @returns {Worker} Worker instance (may be cached)
     */
    worker(notebook_id) {
        if (!this._notebooks.has(notebook_id)) {
            this._notebooks.set(notebook_id, new Worker(this.ws_address, notebook_id))
        }
        return this._notebooks.get(notebook_id)
    }

    /**
     * Create a new notebook from text content
     *
     * This method uploads notebook content to the server via /notebookupload,
     * creates a Worker instance, connects to it, and restarts it for
     * proper initialization.
     *
     * @param {string} notebook_text - Pluto notebook text content (.jl format)
     * @returns {Promise<Worker>} Connected and initialized Worker instance
     * @throws {Error} If upload fails, connection fails, or restart fails
     *
     * @example
     * const worker = await host.createWorker(`
     *   ### A Pluto.jl notebook ###
     *   # v0.19.40
     *
     *   x = 1 + 1
     * `);
     */
    async createWorker(notebook_text) {
        try {
            // Upload notebook text to server using /notebookupload endpoint
            const response = await fetch(`${this.server_url}/notebookupload`, {
                method: "POST",
                body: notebook_text.trim(),
            })

            if (!response.ok) {
                throw new Error(`Failed to upload notebook: ${response.status} ${response.statusText}`)
            }

            // Get the notebook ID from the response
            const notebook_id = await response.text()

            // Create and connect to the new notebook
            const notebook = this.worker(notebook_id)
            if (!notebook) {
                throw new Error(`Notebook ${notebook_id} could not be created properly`)
            }
            const connected = await notebook.connect()

            if (!connected) {
                throw new Error("Failed to connect to newly created notebook")
            }

            // Restart the notebook to ensure proper initialization
            await notebook.restart()

            return notebook
        } catch (error) {
            console.error("Failed to create notebook:", error)
            throw error
        }
    }
}

/**
 * Worker - A programmatic interface to interact with a specific Pluto notebook
 * without the full Editor UI component.
 *
 * This class provides the core functionality of the Editor.js component:
 * 1. Connection management to Pluto backend via WebSocket
 * 2. Notebook state management (mirroring Editor.js state structure)
 * 3. Cell code updates and execution
 * 4. Real-time state synchronization
 *
 * The state management is designed to be compatible with Editor.js:
 * - Uses the same notebook state structure
 * - Handles patches the same way
 * - Maintains the same cell lifecycle
 *
 * @example
 * const worker = host.worker("notebook-uuid");
 * await worker.connect();
 *
 * // Add and run a cell
 * const cellId = await worker.addSnippet(0, "x = 1 + 1");
 *
 * // Update cell code
 * await worker.updateSnippetCode(cellId, "x = 2 + 2");
 *
 * // Listen for updates
 * const unsubscribe = worker.onUpdate((event) => {
 *   console.log("Notebook updated:", event);
 * });
 */
export class Worker {
    /**
     * Create a new Worker instance
     *
     * Note: This constructor only creates the instance. You must call connect()
     * to establish the WebSocket connection and initialize the notebook state.
     *
     * @param {string} ws_address - WebSocket address to connect to
     * @param {string} notebook_id - Specific notebook ID to connect to
     */
    constructor(ws_address, notebook_id) {
        /** @type {string} */
        this.ws_address = ws_address
        /** @type {string} */
        this.notebook_id = notebook_id
        /** @type {boolean} */
        this.connected = false
        /** @type {boolean} */
        this.initializing = true
        /** @type {*} */
        this.notebook_status = null

        /** @type {Record<string, import("../components/Editor.js").CellInputData>} */
        this.cell_inputs_local = {}

        /** @type {import("../components/Editor.js").NotebookData*/
        this.notebook_state = empty_notebook_state({
            notebook_id: this.notebook_id,
        })

        /** @type {number} */
        this.last_update_time = 0
        /** @type {number} */
        this.pending_local_updates = 0
        /** @type {number} */
        this.last_update_counter = -1
        /** @type {import("../common/PlutoConnection.js").PlutoConnection | null} */
        this.client = null

        /** @type {Set<Function>} */
        this._update_handlers = new Set()
        /** @type {Set<Function>} */
        this._connection_status_handlers = new Set()
        /** @type {Promise<void>} */
        this._update_queue_promise = Promise.resolve()

        /** @type {Promise<void>} */
        this.notebook_ready_promise = Promise.resolve()

        // Initialize notebook state
        this.cell_inputs_local = {}
        this.last_update_time = 0
    }

    async wait(ready = true) {
        // Sleep for 35ms
        await new Promise((r) => setTimeout(r, 35))
        if (this.isIdle() === ready) {
            return
        }

        return new Promise((resolve, reject) => {
            const cleanup = this.onUpdate(() => {
                if (this.isIdle() === ready) {
                    cleanup()
                    resolve()
                }
            })
        })
    }

    /**
     * Connect to the Pluto backend WebSocket for this notebook
     *
     * This method establishes the WebSocket connection, initializes the notebook
     * state, and syncs with the server. Must be called before other operations.
     *
     * @returns {Promise<boolean>} True if connection and initialization successful
     * @throws {Error} If connection fails or notebook doesn't exist
     */
    async connect() {
        if (this.connected) {
            return true
        }

        try {
            this.client = await create_pluto_connection({
                ws_address: this.ws_address,
                on_unrequested_update: this._handle_update.bind(this),
                on_connection_status: this._handle_connection_status.bind(this),
                on_reconnect: this._handle_reconnect.bind(this),
                connect_metadata: { notebook_id: this.notebook_id },
            })

            // Initialize notebook state
            if (this.client.notebook_exists) {
                this.notebook_state = empty_notebook_state({
                    notebook_id: this.notebook_id,
                })

                // Ensure required structures exist for patches
                if (!this.notebook_state.cell_results) {
                    this.notebook_state.cell_results = {}
                }
                if (!this.notebook_state.status_tree) {
                    this.notebook_state.status_tree = {
                        subtasks: {},
                        finished_at: 0,
                        name: "noop",
                        started_at: Date.now(),
                        success: true,
                        timing: "local",
                    }
                }
            }

            if (!this.client.notebook_exists) {
                console.error("Notebook does not exist. Not connecting.")
                return false
            }

            // Send initial update_notebook request to sync state
            console.debug("Sending update_notebook request...")
            const response = await this.client.send("update_notebook", { updates: [] }, { notebook_id: this.notebook_id }, false)
            console.debug({ response })
            console.debug("Received update_notebook request")

            this.initializing = false

            return true
        } catch (error) {
            console.error("Failed to connect to Pluto backend:", error)
            return false
        }
    }

    /**
     * Close the connection to this notebook
     */
    close() {
        if (this.client && this.client.kill) {
            this.client.kill()
        }
        this.connected = false
        this.client = null
        this.notebook_state = empty_notebook_state()
        this._update_handlers.clear()
        this._connection_status_handlers.clear()
    }

    /**
     * Shutdown the running notebook on the server
     *
     * This terminates the notebook process and removes it from the server.
     * After shutdown, the notebook instance becomes unusable and should be discarded.
     *
     * @returns {Promise<boolean>} True if shutdown successful
     * @throws {Error} If not connected to notebook
     */
    async shutdown() {
        if (!this.client) {
            throw new Error("Not connected to notebook")
        }

        try {
            // Send shutdown command to the server
            await this.client.send("shutdown_notebook", { keep_in_session: false }, { notebook_id: this.notebook_id }, false)

            // Close the local connection
            this.close()

            return true
        } catch (error) {
            console.error("Failed to shutdown notebook:", error)
            return false
        }
    }

    /**
     * Restart the notebook process
     *
     * This clears risky file metadata and sends a restart_process command to the server.
     * All cell execution state is reset, but cell code is preserved.
     *
     * @param {boolean} [maybe_confirm=false] - Whether to require confirmation for risky files (unused in API context)
     * @returns {Promise<void>}
     * @throws {Error} If not connected to notebook or restart fails
     */
    async restart(maybe_confirm = false) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        try {
            // Clear risky file metadata if present
            await this._update_notebook_state((nb) => {
                if (nb.metadata?.risky_file_source) {
                    delete nb.metadata.risky_file_source
                }
            })

            // Send restart command to server
            // Awaiting this is futile, I think (@pankgeorg, 2/8/2025)
            this.client.send(
                "restart_process",
                {},
                {
                    notebook_id: this.notebook_id,
                }
            )

            this._notify_update("notebook_restarted", {
                notebook_id: this.notebook_id,
            })
        } catch (error) {
            console.error("Failed to restart notebook:", error)
            throw error
        }
    }

    /**
     * Execute a function within the Julia context
     *
     * @param {string} symbol - Function symbol to execute
     * @param {Array<any>} [arguments=[]] - Arguments to pass to the function
     * @returns {Promise<[boolean, any]>} Function result
     * @throws {Error} Not implemented
     */
    async execute(input) {
        const cell_id = "00000000-0000-0208-1991-000000000000"
        try {
            if (!this.notebook_state.cell_results[cell_id]) {
                console.log()
                await this.waitSnippet(
                    this.notebook_state.cell_execution_order.length - 2,
                    `begin
    using AbstractPlutoDingetjes
	function eval_in_pluto(x::String)
		id = PlutoRunner.moduleworkspace_count[]
		new_workspace_name = Symbol("workspace#", id)
		Core.eval(getproperty(Main, new_workspace_name), Meta.parse(x))
	end
	AbstractPlutoDingetjes.Display.with_js_link(eval_in_pluto)
end`,
                    { ...DEFAULT_CELL_METADATA, code_folded: true },
                    "00000000-0000-0208-1991-000000000000"
                )
            }
            const link_id = this.notebook_state.cell_results[cell_id].output.body.split('", "')[1].substr(0, 16)
            return this.client
                .send(
                    "request_js_link_response",
                    {
                        cell_id,
                        link_id,
                        input,
                    },
                    { notebook_id: this.notebook_id }
                )
                .then((r) => r.message)
        } catch (ex) {
            console.error(ex)
            throw ex
        }
    }

    getBonds() {
        return this.notebook_state.bonds
    }

    /**
     *
     * @param {string} name name of bound variable
     * @param {*} value value (not in wrapper object)
     */
    async setBond(name, value) {
        await this._update_notebook_state((notebook) => {
            let new_bond = { value }
            notebook.bonds[name] = new_bond
        })
    }

    /**
     *
     * @param {string} symbol: the symbol to query for
     */
    async getDocs(symbol) {
        const { message } = await this.client.send("docs", { query: symbol.replace(/^\?/, "") }, { notebook_id: this.notebook_id })
        if (message.status === "👍") {
            return message.doc
        }
        if (message.status === "⌛") {
            return
        }
    }

    /**
     * Get the current notebook state (equivalent to Editor.js this.state.notebook)
     *
     * Returns the complete notebook state structure including cell_inputs,
     * cell_results, cell_order, and metadata. This matches the structure
     * used by Editor.js.
     *
     * @returns {NotebookData|null} Current notebook state, or null if not connected
     */
    getState() {
        return this.notebook_state
    }

    /**
     * Get specific cell data
     *
     * @param {string} cell_id - Cell UUID
     * @returns {CellData|null} Cell data object with input, result, and local state
     */
    getSnippet(cell_id) {
        if (!this.notebook_state) return null

        return {
            input: this.notebook_state.cell_inputs?.[cell_id],
            result: this.notebook_state.cell_results?.[cell_id],
        }
    }

    /**
     * Get all cells in order
     *
     * Returns cells in the order specified by cell_order, with complete
     * input and result data for each cell.
     *
     * @returns {Array<{cell_id: string} & CellData>} Array of cell data objects in execution order
     */
    getSnippets() {
        if (!this.notebook_state || !this.notebook_state.cell_order) return []

        return this.notebook_state.cell_order.map((cell_id) => ({
            cell_id,
            ...this.getSnippet(cell_id),
        }))
    }

    /**
     * Update cell code and optionally run it
     *
     * This updates the cell's code and optionally triggers execution.
     * The change is first stored locally, then sent to the server.
     *
     * @param {string} cell_id - Cell UUID
     * @param {string} code - New cell code
     * @param {boolean} [run=true] - Whether to run the cell after updating
     * @param {Object} [metadata={}] - Additional cell metadata
     * @returns {Promise<Object|undefined>} Response from backend if run=true
     * @throws {Error} If not connected to notebook
     */
    async updateSnippetCode(cell_id, code, run = true, metadata = {}) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        // Update local state
        this.cell_inputs_local[cell_id] = {
            ...this.cell_inputs_local[cell_id],
            code,
            metadata: { ...this.cell_inputs_local[cell_id]?.metadata, ...metadata },
        }
        this._notify_update("cell_local_update", { cell_id, code })

        if (run) {
            return await this.setSnippetsAndRun([cell_id], { cell_id: metadata })
        }
    }

    /**
     * Submit local cell changes to backend and run cells
     * @param {Array<string>} cell_ids - Array of cell UUIDs to update and run
     * @param {Record<string, Object>} metadata_record - Metadata for each cell
     * @returns {Promise<Object>} - Response from backend
     */
    async setSnippetsAndRun(cell_ids, metadata_record) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        if (cell_ids.length === 0) {
            return { disabled_cells: {} }
        }

        const new_task = this._update_queue_promise.then(async () => {
            // Create patches for the cell code changes
            const [new_notebook, changes] = produceWithPatches(this.notebook_state, (notebook) => {
                for (let cell_id of cell_ids) {
                    if (this.cell_inputs_local[cell_id]) {
                        notebook.cell_inputs[cell_id] = {
                            ...notebook.cell_inputs[cell_id],
                            code: this.cell_inputs_local[cell_id].code,
                            metadata: {
                                ...notebook.cell_inputs[cell_id].metadata,
                                ...metadata_record[cell_id],
                            },
                        }
                    }
                }
            })

            if (changes.length === 0) {
                return { disabled_cells: {} }
            }

            this.pending_local_updates++

            try {
                // Send the update to the backend
                const response = await this.client.send("update_notebook", { updates: changes }, { notebook_id: this.notebook_id }, false)

                if (response.message?.response?.update_went_well === "👎") {
                    throw new Error(`Pluto update_notebook error: (from Julia: ${response.message.response.why_not})`)
                }

                // Update local state
                this.notebook_state = new_notebook
                this.last_update_time = Date.now()

                // Clear local changes for updated cells
                for (let cell_id of cell_ids) {
                    delete this.cell_inputs_local[cell_id]
                }

                // Run the cells
                const run_response = await this.client.send("run_multiple_cells", { cells: cell_ids }, { notebook_id: this.notebook_id })

                this._notify_update("cells_updated", {
                    cell_ids,
                    response: run_response,
                })

                return run_response.message
            } finally {
                this.pending_local_updates--
            }
        })

        this._update_queue_promise = new_task.catch(console.error)
        return await new_task
    }

    /**
     * Add a new cell to the notebook and wait for its result.
     *
     * Creates a new cell with a generated UUID, inserts it at the specified
     * position, and immediately runs it. The cell is added to both cell_inputs
     * and cell_results with appropriate initial state. Waits
     *
     * @param {number} [index=0] - Position to insert the cell (0-based)
     * @param {string} [code=""] - Initial cell code
     * @param {Object} [metadata={}] - Additional cell metadata
     * @param {string} [cell_id=uuidv4()] - Snippet's UUID, if you need to specifically set one     * @param {number} [timeout=-1] - Timeout to reject the results. defaults to -1 which disables the timeout
     * @returns {Promise<import("../components/Editor.js").CellResultData>} The output of the added cell
     * @throws {Error} If not connected to notebook
     *
     * @example
     * const cellOutput = await worker.waitSnippet(0, "println(\"Hello World\")");
     */

    async waitSnippet(index = 0, code = "", metadata = {}, cell_id = uuidv4(), timeout = -1) {
        await this.addSnippet(index, code, metadata, cell_id)
        return await new Promise((resolve, reject) => {
            let t = 0
            const cleanup = this.onUpdate((v) => {
                if (v.type === "notebook_updated" && isTerminalStatus(getStatus(this, cell_id))) {
                    resolve(getResult(this, cell_id))
                    cleanup()
                    clearTimeout(t)
                }
            })
            if (timeout > 0) {
                t = setTimeout(() => {
                    cleanup()
                    reject(null)
                }, timeout)
            }
        })
    }
    /**
     * Add a new cell to the notebook
     *
     * Creates a new cell with a generated UUID, inserts it at the specified
     * position, and immediately runs it. The cell is added to both cell_inputs
     * and cell_results with appropriate initial state.
     *
     * @param {number} [index=0] - Position to insert the cell (0-based)
     * @param {string} [code=""] - Initial cell code
     * @param {Object} [metadata={}] - Additional cell metadata
     * @param {string} [cell_id=uuidv4()] - Snippet's UUID, if you need to specifically set one
     * @returns {Promise<string>} UUID of the newly created cell
     * @throws {Error} If not connected to notebook
     *
     * @example
     * const cellId = await worker.addSnippet(0, "println(\"Hello World\")");
     */
    async addSnippet(index = 0, code = "", metadata = {}, cell_id = uuidv4()) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        await this._update_notebook_state((notebook) => {
            notebook.cell_inputs[cell_id] = {
                cell_id: cell_id,
                code,
                code_folded: false,
                metadata: { ...DEFAULT_CELL_METADATA, ...metadata },
            }

            // Add to cell_order
            notebook.cell_order = [...notebook.cell_order.slice(0, index), cell_id, ...notebook.cell_order.slice(index, Infinity)]
        })

        // Wait for the server to confirm the cell addition
        await this.client.send("run_multiple_cells", { cells: [cell_id] }, { notebook_id: this.notebook_id })

        // Update local state to match server response
        // this.notebook_state = new_notebook;

        this._notify_update("cell_added", { cell_id, index })

        return cell_id
    }

    /**
     * Move cells to a new position in the notebook. The order of `cell_ids` is preserved in the result.
     *
     * @param {Array<string>} cell_ids - Cell UUIDs to move, in desired order
     * @param {number} index - Target position in the current cell order (before removing the moved cells)
     * @returns {Promise<void>}
     *
     * @example
     * // Given cell_order [A, B, C, D, E], move C and A to position 1 (in that order):
     * await worker.moveSnippets(["C", "A"], 1)
     * // Result: [B, C, A, D, E]
     */
    async moveSnippets(cell_ids, index) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        index = Math.max(0, index)
        const cell_ids_set = new Set(cell_ids)

        await this._update_notebook_state((notebook) => {
            let before = notebook.cell_order.slice(0, index).filter((x) => !cell_ids_set.has(x))
            let after = notebook.cell_order.slice(index, Infinity).filter((x) => !cell_ids_set.has(x))
            notebook.cell_order = [...before, ...cell_ids, ...after]
        })

        this._notify_update("cells_moved", { cell_ids, index })
    }

    /**
     * Delete cells from the notebook
     * @param {Array<string>} cell_ids - Array of cell UUIDs to delete
     * @returns {Promise<void>}
     */
    async deleteSnippets(cell_ids) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        await this._update_notebook_state((notebook) => {
            for (let cell_id of cell_ids) {
                delete notebook.cell_inputs[cell_id]
            }
            notebook.cell_order = notebook.cell_order.filter((cell_id) => !cell_ids.includes(cell_id))
        })

        // Clear local state for deleted cells
        for (let cell_id of cell_ids) {
            delete this.cell_inputs_local[cell_id]
        }

        // Run empty cells array to trigger dependency updates
        await this.client.send("run_multiple_cells", { cells: [] }, { notebook_id: this.notebook_id })

        this._notify_update("cells_deleted", { cell_ids })
    }

    /**
     * Move the notebook to a new file path. The backend will save the notebook to the new path,
     * delete the old file, move any associated `.assets` directory, and update the Julia process's
     * working directory.
     *
     * @param {string} new_path - Absolute path for the notebook file
     * @returns {Promise<void>}
     * @throws {Error} If the new path already exists on the server
     *
     * @example
     * await worker.moveTo("/home/user/notebooks/analysis.jl")
     */
    async moveTo(new_path) {
        if (!this.client || !this.notebook_state) {
            throw new Error("Not connected to notebook")
        }

        await this._update_notebook_state((notebook) => {
            notebook.in_temp_dir = false
            notebook.path = new_path
        })

        this._notify_update("notebook_moved", { path: new_path })
    }

    /**
     * Interrupt notebook execution
     * @returns {Promise<void>}
     */
    async interrupt() {
        if (!this.client) {
            throw new Error("Not connected to notebook")
        }

        await this.client.send("interrupt_all", {}, { notebook_id: this.notebook_id }, false)
    }

    /**
     * Register a callback for updates from the WebSocket
     *
     * This callback will be called every time a state update comes from the websocket.
     * Use this to react to cell execution results, notebook state changes, etc.
     *
     * @param {function(event: import("./index.js").UpdateEvent): void} callback - Function to call on updates
     * @returns {function(): void} Unsubscribe function to stop receiving updates
     *
     * @example
     * const unsubscribe = worker.onUpdate((event) => {
     *   if (event.type === 'notebook_updated') {
     *     console.log('Notebook state changed');
     *   }
     * });
     *
     * // Later, stop listening
     * unsubscribe();
     */
    onUpdate(callback) {
        this._update_handlers.add(callback)
        return () => this._update_handlers.delete(callback)
    }

    /**
     * Register a handler for connection status changes
     * @param {Function} handler - Function to call on connection status changes
     * @returns {function(): void} Unsubscribe function
     */
    onConnectionStatus(handler) {
        this._connection_status_handlers.add(handler)
        return () => this._connection_status_handlers.delete(handler)
    }

    /**
     * Check if notebook is currently idle (not running any cells)
     *
     * A notebook is considered idle when:
     * - No local updates are pending
     * - No cells are currently running or queued
     *
     * @returns {boolean} True if notebook is idle
     */
    isIdle() {
        if (!this.notebook_state) return true

        return !(this.pending_local_updates > 0 || Object.values(this.notebook_state.cell_results).some((cell) => cell.running || cell.queued))
    }

    // Private methods

    /**
     * Handle update from WebSocket
     * @param {Object} update - Update object from server
     * @param {boolean} by_me - Whether update was triggered by this client
     * @private
     */
    _handle_update(update, by_me) {
        if (this.notebook_state?.notebook_id === update.notebook_id) {
            const message = update.message
            switch (update.type) {
                case "notebook_diff":
                    this._handle_notebook_diff(message)
                    break
                default:
                    console.warn("Received unknown update type!", update)
                    break
            }
        }
    }

    /**
     * Handle notebook diff message
     * @param {Object} message - Notebook diff message
     * @private
     */
    _handle_notebook_diff(message) {
        if (message?.counter != null) {
            if (message.counter <= this.last_update_counter) {
                console.error("State update out of order", message.counter, this.last_update_counter)
                return
            }
            this.last_update_counter = message.counter
        }

        if (message.patches && message.patches.length > 0) {
            // Serialize patch application through the update queue to avoid race conditions
            // This ensures patches are applied sequentially, matching Editor.js behavior
            const new_task = this._update_queue_promise.then(() => {
                return this._apply_patches(message.patches)
            })

            // Update the queue promise, catching any errors to prevent breaking the chain
            this._update_queue_promise = new_task.catch((error) => {
                console.error("Error in patch application queue:", error)
            })
        }
    }

    /**
     * Apply patches to notebook state
     * @param {Array} patches - Array of patches to apply
     * @returns {Promise<void>} Promise that resolves when patches are applied
     * @private
     */
    _apply_patches(patches) {
        return new Promise((resolve, reject) => {
            try {
                // Ensure we have a valid notebook state before applying patches
                if (!this.notebook_state) {
                    console.warn("No notebook state available, skipping patch application")
                    resolve()
                    return
                }

                // Validate patches before applying
                if (!Array.isArray(patches) || patches.length === 0) {
                    console.warn("Invalid or empty patches, skipping application")
                    resolve()
                    return
                }

                let new_notebook = applyPatches(this.notebook_state, patches)

                this.notebook_state = new_notebook
                this.last_update_time = Date.now()

                // Notify handlers after successful patch application
                this._notify_update("notebook_updated", {
                    patches,
                    notebook_id: this.notebook_id,
                })

                resolve()
            } catch (exception) {
                console.error("Failed to apply patches:", exception)
                console.error("Notebook state:", this.notebook_state)
                console.error("Patches:", patches)

                // Request state reset from server
                if (this.client && this.connected) {
                    console.info("Resetting state")
                    this.client.send("reset_shared_state", {}, { notebook_id: this.notebook_id }, false)
                }

                reject(exception)
            }
        })
    }

    /**
     * Handle connection status change
     * @param {boolean} connected - Whether connection is active
     * @param {boolean} hopeless - Whether connection is hopeless
     * @private
     */
    _handle_connection_status(connected, hopeless) {
        this.connected = connected
        this._notify_connection_status_change(connected, hopeless)
    }

    /**
     * Handle reconnect event
     * @returns {Promise<boolean>} Whether reconnect was successful
     * @private
     */
    async _handle_reconnect() {
        console.warn("Reconnected! Checking states")

        if (this.client) {
            await this.client.send("reset_shared_state", {}, { notebook_id: this.notebook_id }, false)
        }

        return true
    }

    /**
     * Update notebook state using a mutate function
     * @param {Function} mutate_fn - Function to mutate the notebook state
     * @returns {Promise<void>}
     * @private
     */
    async _update_notebook_state(mutate_fn) {
        if (!this.notebook_state) return

        const [notebook, changes] = produceWithPatches(this.notebook_state, (notebook) => {
            mutate_fn(notebook)
        })

        if (changes.length === 0) return

        this.pending_local_updates++

        try {
            // The changes to be sent should already exist locally
            // because patches are going to be diffed against that
            this.notebook_state = notebook
            const response = await this.client.send("update_notebook", { updates: changes }, { notebook_id: this.notebook_id }, false)

            if (response.message?.response?.update_went_well === "👎") {
                throw new Error(`Pluto update_notebook error: (from Julia: ${response.message.response.why_not})`)
            }
            this.last_update_time = Date.now()
        } finally {
            this.pending_local_updates--
        }
    }

    /**
     * Notify update handlers
     * @param {string} event_type - Type of event
     * @param {*} data - Event data
     * @private
     */
    _notify_update(event_type, data) {
        this._update_handlers.forEach((handler) => {
            try {
                handler({
                    type: event_type,
                    data,
                    timestamp: Date.now(),
                    notebook: this.notebook_state,
                })
            } catch (error) {
                console.error("Error in update handler:", error)
            }
        })
    }

    /**
     * Notify connection status handlers
     * @param {boolean} connected - Whether connection is active
     * @param {boolean} hopeless - Whether connection is hopeless
     * @private
     */
    _notify_connection_status_change(connected, hopeless) {
        this._connection_status_handlers.forEach((handler) => {
            try {
                handler({ connected, hopeless, timestamp: Date.now() })
            } catch (error) {
                console.error("Error in connection status handler:", error)
            }
        })
    }
}
