import puppeteer from "puppeteer"
import path from "path"
import mkdirp from "mkdirp"
import * as process from "process"

// from https://github.com/puppeteer/puppeteer/issues/1908#issuecomment-380308269
class InflightRequests {
    constructor(page) {
        this._page = page
        this._requests = new Map()
        this._history = []
        this._onStarted = this._onStarted.bind(this)
        this._onFinished = this._onFinished.bind(this)
        this._page.on("request", this._onStarted)
        this._page.on("requestfinished", this._onFinished)
        this._page.on("requestfailed", this._onFinished)
    }

    _onStarted(request) {
        // if(request.url().includes("data")) {
        //   console.log('Start', request.url())
        // };
        this._history.push(["started", request.url()])
        this._requests.set(request.url(), 1 + (this._requests.get(request.url()) ?? 0))
    }
    _onFinished(request) {
        // if(request.url().includes("data")) {
        //   console.log('Finish', request.url())
        // };
        this._history.push(["finished", request.url()])
        this._requests.set(
            request.url(),
            -1 +
                /* Multiple requests starts can have a single finish event. */
                Math.min(1, this._requests.get(request.url()) ?? 0)
        )
    }

    inflightRequests() {
        return Array.from([...this._requests.entries()].flatMap(([k, v]) => (v > 0 ? [k] : [])))
    }

    dispose() {
        this._page.off("request", this._onStarted)
        this._page.off("requestfinished", this._onFinished)
        this._page.off("requestfailed", this._onFinished)
    }
}

const with_connections_debug = (page, action) => {
    const tracker = new InflightRequests(page)
    return action()
        .finally(() => {
            tracker.dispose()
            const inflight = tracker.inflightRequests()
            if (inflight.length > 0) {
                // console.warn(
                //     "Open connections: ",
                //     inflight,
                //     tracker._history.filter(([n, u]) => inflight.includes(u))
                // )
                // console.warn([...tracker._requests.entries()])
            }
        })
        .catch((e) => {
            throw e
        })
}

export const getTextContent = (page, selector) => {
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent#differences_from_innertext
    return page.evaluate((selector) => document.querySelector(selector)?.textContent, selector)
}
export const countCells = async (page) =>
    await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll("pluto-cell"))
        return a?.length
    })

export const paste = async (page, code, selector = "body") => {
    const ret = await page.evaluate(
        (code, selector) => {
            var clipboardEvent = new Event("paste", {
                bubbles: true,
                cancelable: true,
                composed: true,
            })
            clipboardEvent["clipboardData"] = {
                getData: () => code,
            }
            document.querySelector(selector).dispatchEvent(clipboardEvent)
        },
        code,
        selector
    )
    return ret
}

export const waitForContent = async (page, selector) => {
    await page.waitForSelector(selector, { visible: true })
    await page.waitForFunction(
        (selector) => {
            const element = document.querySelector(selector)
            return element !== null && element.textContent.length > 0
        },
        { polling: 100 },
        selector
    )
    return getTextContent(page, selector)
}

export const waitForContentToChange = async (page, selector, currentContent) => {
    await page.waitForSelector(selector, { visible: true })
    await page.waitForFunction(
        (selector, currentContent) => {
            const element = document.querySelector(selector)
            console.log(`element:`, element)
            return element !== null && element.textContent !== currentContent
        },
        { polling: 100 },
        selector,
        currentContent
    )
    return getTextContent(page, selector)
}

export const waitForContentToBecome = async (
    /** @type {import("puppeteer").Page} */ page,
    /** @type {string} */ selector,
    /** @type {string} */ targetContent,
    /** @type {{ timeout?: number }} */ options = {}
) => {
    const timeout = options.timeout ?? 30000
    await page.waitForSelector(selector, { visible: targetContent !== "", timeout })
    try {
        await page.waitForFunction(
            (selector, targetContent) => {
                const element = document.querySelector(selector)
                // https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent#differences_from_innertext
                return element !== null && element.textContent === targetContent
            },
            { polling: 100, timeout },
            selector,
            targetContent
        )
    } catch (e) {
        console.error("Failed! Current content: ", JSON.stringify(await getTextContent(page, selector)), "Expected content: ", JSON.stringify(targetContent))
        throw e
    }
    return getTextContent(page, selector)
}

export const clickAndWaitForNavigation = async (/** @type {import("puppeteer").Page} */ page, /** @type {string} */ selector) => {
    // Use a shorter timeout for networkidle0 since it can be unreliable with persistent connections
    // Fall back to domcontentloaded if networkidle0 times out
    let t = with_connections_debug(page, () => page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 })).catch((e) => {
        console.warn("Network idle never happened after navigation... weird!", e)
        // Fallback to domcontentloaded which is more reliable
        return page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 })
    })
    await page.click(selector)
    await t
}

const dismissBeforeUnloadDialogs = (page) => {
    page.on("dialog", async (dialog) => {
        if (dialog.type() === "beforeunload") {
            await dialog.accept()
        }
    })
}
const dismissVersionDialogs = (page) => {
    page.on("dialog", async (dialog) => {
        if (dialog.message().includes("A new version of Pluto.jl is available! 🎉")) {
            console.info("Ignoring version warning for now (but do remember to update Project.toml!).")
            await dialog.accept()
        }
    })
}

const failOnError = (page) => {
    page.on("console", async (msg) => {
        if (msg.type() === "error" && msg.text().includes("PlutoError")) {
            console.error(`Bad PlutoError - Failing\n${msg.text()}`)
            throw new Error("PlutoError encountered. Let's fix this!")
        }
    })
}

let should_be_offline_input = process.env["PLUTO_TEST_OFFLINE"]?.toLowerCase() ?? "false"
let should_be_offline = [true, 1, "true", "1"].includes(should_be_offline_input)
console.log(`Offline mode enabled: ${should_be_offline}`)

const blocked_domains = ["cdn.jsdelivr.net", "unpkg.com", "cdn.skypack.dev", "esm.sh", "firebase.google.com"]
const hide_warning = (url) => url.includes("mathjax")

export const createPage = async (browser) => {
    /** @type {import("puppeteer").Page} */
    const page = await browser.newPage()

    failOnError(page)
    dismissBeforeUnloadDialogs(page)
    dismissVersionDialogs(page)

    if (should_be_offline) {
        page.setRequestInterception(true)
        page.on("request", (request) => {
            if (blocked_domains.some((domain) => request.url().includes(domain))) {
                if (!hide_warning(request.url())) console.info(`Blocking request to ${request.url()}`)
                request.abort()
            } else {
                request.continue()
            }
        })
    }

    return page
}

let testname = () => expect.getState()?.currentTestName?.replace(/[ \:]/g, "_") ?? "unnkown"

export const lastElement = (arr) => arr[arr.length - 1]

const getFixturesDir = () => path.join(__dirname, "..", "fixtures")

export const getArtifactsDir = () => path.join(__dirname, "..", "artifacts")

export const getFixtureNotebookPath = (name) => path.join(getFixturesDir(), name)

export const getTemporaryNotebookPath = () => path.join(getArtifactsDir(), `temporary_notebook_${testname()}_${Date.now()}.jl`)

export const getTestScreenshotPath = () => {
    return path.join(getArtifactsDir(), `screenshot_${testname()}_${Date.now()}.png`)
}

export const saveScreenshot = async (page, screenshot_path = getTestScreenshotPath()) => {
    let dirname = path.dirname(screenshot_path)
    await mkdirp(dirname) // Because some of our tests contain /'s 🤷‍♀️
    await page.screenshot({ path: screenshot_path })
}
