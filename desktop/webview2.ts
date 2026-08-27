// Windows only, and it must run before the first window exists — main.ts imports this FIRST, for
// its side effect alone.
//
// WebView2 defaults its user-data folder to `<exe path>.WebView2`, i.e. NEXT TO THE BINARY. Our MSI
// installs into %ProgramFiles%\SpaceStation (deno desktop hard-codes ProgramFiles64Folder — there is
// no per-user install option), and a standard user cannot write there. So creating the WebView2
// environment fails, the window is never created, and the process keeps running with no UI at all:
// exactly issue #55, where clicking the app repeatedly left five headless SpaceStation.exe processes
// and, on the first launch after a reboot, one native dialog reading
//   "Microsoft Edge can't read and write to its data directory:
//    C:\Program Files\SpaceStation\SpaceStation.exe.WebView2\EBWebView"
// Microsoft documents this exact case: an unpackaged app in a protected install directory MUST name
// its own user-data folder.
//
// WEBVIEW2_USER_DATA_FOLDER is the documented override — the WebView2 loader reads it (via
// GetEnvironmentVariableW) when the environment is created. Setting it from here reaches that read
// because our code runs INSIDE the webview host process: the app's executable IS the laufey_webview
// host, which loads the Deno runtime and only then runs this module, while the WebView2 environment
// is created later, on the first `new Deno.BrowserWindow(...)`. Same process, so `Deno.env.set` lands
// in the very environment block the loader inspects.
//
// Nothing here runs off Windows: every other platform keeps its own default.

/** Where WebView2 may keep its (large, cache-like, machine-local) profile. LOCALAPPDATA — never
 *  roaming APPDATA, which corporate roaming profiles would try to sync. */
export const webview2_user_data_dir = (): string | null => {
    if (Deno.build.os !== "windows") return null
    const base = Deno.env.get("LOCALAPPDATA") ?? Deno.env.get("USERPROFILE") ?? Deno.env.get("HOME")
    if (base == null || base.trim() === "") return null
    return `${base}\\SpaceStation\\WebView2`
}

/** Point WebView2 at a writable per-user folder. Returns the folder, or null when nothing was done
 *  (not Windows, or the user/admin already chose one — an explicit setting always wins). */
export const pin_webview2_user_data_dir = (): string | null => {
    if (Deno.build.os !== "windows") return null
    if ((Deno.env.get("WEBVIEW2_USER_DATA_FOLDER") ?? "").trim() !== "") return null
    const dir = webview2_user_data_dir()
    if (dir == null) return null
    try {
        // Create it ourselves: a path WebView2 cannot create is the whole bug, so fail here — where
        // we can say why — rather than inside a native dialog with no window behind it.
        Deno.mkdirSync(dir, { recursive: true })
        Deno.env.set("WEBVIEW2_USER_DATA_FOLDER", dir)
        return dir
    } catch (e) {
        console.error(`could not prepare the WebView2 data directory at ${dir}:`, e)
        return null
    }
}

pin_webview2_user_data_dir()
