export const open_from_path = () => {
    console.log("Calling plutoDesktop -> open_from_path")
    // @ts-ignore
    window.plutoDesktop.fileSystem.openNotebook("path")
}
export const open_from_path_in_new_window = (/** @type string */ path) => {
    console.log("Calling plutoDesktop -> open_from_path_in_new_window")
    // @ts-ignore
    window.plutoDesktop.fileSystem.openNotebook("path", path, { newWindow: true })
}
export const open_from_url = (/** @type string */ url) => {
    console.log("Calling plutoDesktop -> open_from_url")
    // @ts-ignore
    window.plutoDesktop.fileSystem.openNotebook("url", url)
}
export const open_main_menu = () => {
    console.log("Calling plutoDesktop -> open_main_menu")
    // @ts-ignore
    window.plutoDesktop.openMainMenu()
}

export const move_notebook = () => {
    console.log("Calling plutoDesktop -> move_notebook")
    // @ts-ignore
    window.plutoDesktop.fileSystem.moveNotebook()
}

export const export_notebook = (/** @type {string} */ notebook_id, /** @type {Desktop.PlutoExport} */ type) => {
    console.log("Calling plutoDesktop -> export_notebook")
    // @ts-ignore
    window.plutoDesktop.fileSystem.exportNotebook(notebook_id, type)
}

/**
 * Wait for a signal from electron that the file has been moved.
 *
 * `window.plutoDesktop?.ipcRenderer` is basically what allows the
 * frontend to communicate with the electron side. It is an IPC
 * bridge between render process and main process. More info
 * [here](https://www.electronjs.org/docs/latest/api/ipc-renderer).
 *
 * "PLUTO-MOVE-NOTEBOOK" is an event triggered in the main process
 * once the move is complete, we listen to it using `once`.
 * More info [here](https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendereroncechannel-listener)
 *
 * @returns {Promise<string?>} The path to the new notebook file.
 */
export const wait_for_file_move = () =>
    new Promise((resolve, reject) => {
        window.plutoDesktop?.ipcRenderer.once("PLUTO-MOVE-NOTEBOOK", async (/** @type {string?} */ loc) => {
            resolve(loc)
        })
    })

export const is_desktop = () => !!window.plutoDesktop
export const desktop_version = window.plutoDesktop?.desktopVersion

export const add_block_screen_text_listener = (listener) => {
    window.plutoDesktop?.ipcRenderer.on("set-block-screen-text", listener)
}

export const is_backend_server_loaded = () => {
    return window.plutoDesktop?.isBackendLoaded()
}
