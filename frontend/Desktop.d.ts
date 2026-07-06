declare global {
    /**
     * This namespace is meant for [PlutoDesktop](https://github.com/JuliaPluto/PlutoDesktop)
     * related types and interfaces.
     */
    namespace Desktop {
        type PlutoExport = "file" | "html" | "state" | "pdf"

        /**
         * This type has to be in sync with the API exposed
         * in PlutoDesktop/{branch:main}/src/preload.ts
         */
        type PlutoDesktop = {
            ipcRenderer: {
                on(channel: string, func: (...args: unknown[]) => void): (() => void) | undefined
                once(channel: string, func: (...args: unknown[]) => void): void
            }
            desktopVersion: string
            isBackendLoaded(): Promise<boolean>
            openMainMenu(): void
            fileSystem: {
                /**
                 * @param type [default = 'new'] whether you want to open a new notebook
                 * open a notebook from a path or from a url
                 * @param pathOrURL location to the file, not needed if opening a new file,
                 * opens that notebook. If false and no path is there, opens the file selector.
                 * If true, opens a new blank notebook.
                 */
                openNotebook(type?: "url" | "path" | "new", pathOrURL?: string, options?: { newWindow?: boolean }): void
                moveNotebook(id?: string): void
                exportNotebook(id: string, type: PlutoExport): void
            }
        }
    }
    interface Window {
        plutoDesktop?: Desktop.PlutoDesktop
    }
}

export {}
