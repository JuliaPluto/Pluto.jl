/**
 * @fileoverview Type definitions for the Pluto Notebook API package
 */

// Import notebook data type
import { NotebookData } from "../components/Editor.js"

// Export main API classes
export { Host, Worker } from "./client.js"

// Export resolver
export { resolveIncludes } from "./fs.js"

// Export notebook parser functions
export { default as parse, serialize } from "./parser.js"
export { from_dyadgen as from_julia } from "./from_dyadgen.js"

// Export utility constants
export { DEFAULT_CELL_METADATA, PTOML_CELL_ID, MTOML_CELL_ID } from "./parser.js"
export { EXECUTION_CELL_ID, MODULE_CELL_ID, PKG_CELL_ID } from "./from_dyadgen.js"

export type { NotebookData, CellDependencyData, CellResultData, CellDependencyGraph, CellInputData, CellMetaData } from "../components/Editor.js"
export type { PlutoConnection, WebsocketConnection } from "../common/PlutoConnection.js"

export * from "./getters.ts"
export * from "./template.js"

// Type for update events
export interface UpdateEvent {
    type: "notebook_restarted" | "cell_local_update" | "cells_updated" | "cell_added" | "cells_deleted" | "notebook_updated" | string
    data: any
    timestamp: number
    notebook?: NotebookData
}

// Type for connection status events
export interface ConnectionStatusEvent {
    connected: boolean
    hopeless: boolean
    timestamp: number
}
