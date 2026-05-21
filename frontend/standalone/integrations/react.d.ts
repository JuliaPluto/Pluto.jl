import type { Worker, Host } from "../client.js"
import type { CellResultData } from "../index.js"
import type { LogEntryData } from "../../components/Editor.js"
import type { ReactNode, Context, ComponentType } from "react"

export declare function useSnippetState(worker: Worker, cell_id: string): CellResultData | undefined

export declare function useSnippetLogs(worker: Worker, cell_id: string): LogEntryData[] | undefined

export interface RainbowContextValue {
    url: string
    host: Host
    worker: Worker | undefined
    setUrl: (url: string) => void
    setHost: (host: Host) => void
    setWorker: (worker: Worker | undefined) => void
}

export declare const RainbowContext: Context<RainbowContextValue | undefined>

export interface RainbowProviderProps {
    children: ReactNode
    props: {
        url?: string
    }
}

export declare const RainbowProvider: ComponentType<RainbowProviderProps>

export declare function usePlutoRainbow(): RainbowContextValue
