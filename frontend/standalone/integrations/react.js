import { Host, Worker } from "../client.js"
import { useState, useEffect, useMemo, createContext, createElement, useContext } from "react"

/**
 * @param {Worker} worker
 * @param {string} cell_id
 *
 * @returns {undefined | import("../index.js").CellResultData}
 */
export function useSnippetState(worker, cell_id) {
    const initialData = worker.getState()?.cell_results?.[cell_id]
    const [data, setData] = useState(initialData)
    useEffect(() => {
        const cleanup = worker.onUpdate((event) => {
            if (event.type === "notebook_updated") {
                /** @type {import("../index.js").NotebookData} */
                const state = event.notebook
                if (state.cell_results[cell_id] !== data) {
                    setData(state.cell_results)
                }
            }
        })
        return cleanup
    }, [worker, cell_id, data])
    return data
}

/**
 * @param {Worker} worker
 * @param {string} cell_id
 *
 * @returns {undefined | Array<import("../../components/Editor.js").LogEntryData>}
 */
export function useSnippetLogs(worker, cell_id) {
    const initialData = worker.getState()?.cell_results?.[cell_id].logs
    const [data, setData] = useState(initialData)
    useEffect(() => {
        const cleanup = worker.onUpdate((event) => {
            if (event.type === "notebook_updated") {
                /** @type {import("../index.js").NotebookData} */
                const state = event.notebook
                const logs = state.cell_results[cell_id].logs
                if (logs !== data) {
                    setData(logs)
                }
            }
        })
        return cleanup
    }, [worker, cell_id, data])
    return data
}

export const RainbowContext = createContext()

export const RainbowProvider = ({ children, props }) => {
    const [url, setUrl] = useState(props.url ?? "http://localhost:1234")
    const [host, setHost] = useState(new Host(url))
    const [worker, setWorker] = useState()
    const value = useMemo(() => {
        return {
            url,
            host,
            worker,
            setUrl,
            setHost,
            setWorker,
        }
    }, [url, host, worker, setUrl, setHost, setWorker])
    return createElement(RainbowContext.Provider, { value }, ...children)
}

export const usePlutoRainbow = () => {
    const context = useContext(RainbowContext)
    if (!context) {
        throw new Error("useHost must be used within a RainbowProvider")
    }
    return context
}
