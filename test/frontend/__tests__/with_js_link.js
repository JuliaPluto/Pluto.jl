import puppeteer from "puppeteer"
import { saveScreenshot, createPage, waitForContentToBecome, getTextContent } from "../helpers/common"
import {
    importNotebook,
    getPlutoUrl,
    shutdownCurrentNotebook,
    setupPlutoBrowser,
    getLogs,
    getLogSelector,
    writeSingleLineInPlutoInput,
    runAllChanged,
    waitForPlutoToCalmDown,
    gotoPlutoMainMenu,
} from "../helpers/pluto"

describe("with_js_link", () => {
    /**
     * Launch a shared browser instance for all tests.
     * I don't use jest-puppeteer because it takes away a lot of control and works buggy for me,
     * so I need to manually create the shared browser.
     * @type {import("puppeteer").Browser}
     */
    let browser = null
    /** @type {import("puppeteer").Page} */
    let page = null
    beforeAll(async () => {
        browser = await setupPlutoBrowser()
        page = await createPage(browser)
        await gotoPlutoMainMenu(page)

        await importNotebook(page, "with_js_link.jl", { timeout: 120 * 1000 })
    })
    beforeEach(async () => {})
    afterEach(async () => {
        await saveScreenshot(page)
    })
    afterAll(async () => {
        await shutdownCurrentNotebook(page)
        await page.close()
        page = null
        await browser.close()
        browser = null
    })

    const submit_ev_input = (id, value) =>
        page.evaluate(
            (id, value) => {
                document.querySelector(`.function_evaluator#${id} input`).value = value

                document.querySelector(`.function_evaluator#${id} input[type="submit"]`).click()
            },
            id,
            value
        )

    const ev_output_sel = (id) => `.function_evaluator#${id} textarea`

    const expect_ev_output = async (id, expected) => {
        expect(await waitForContentToBecome(page, ev_output_sel(id), expected)).toBe(expected)
    }

    it("basic", async () => {
        ////// BASIC
        await expect_ev_output("sqrt", "30")
        await submit_ev_input("sqrt", "25")
        await expect_ev_output("sqrt", "5")
    })

    // TODO test refresh

    // TODO RERUN cELL

    // TODO invalidation

    it("LOGS AND ERRORS", async () => {
        //////
        let log_id = "33a2293c-6202-47ca-80d1-4a9e261cae7f"
        const logs1 = await getLogs(page, log_id)
        expect(logs1).toEqual([{ class: "Info", description: "you should see this log 4", kwargs: {} }])
        await submit_ev_input("logs1", "90")

        // TODO
        await page.waitForFunction(
            (sel) => {
                return document.querySelector(sel).textContent.includes("90")
            },
            { polling: 100 },
            getLogSelector(log_id)
        )
        const logs2 = await getLogs(page, log_id)
        expect(logs2).toEqual([
            { class: "Info", description: "you should see this log 4", kwargs: {} },
            { class: "Info", description: "you should see this log 90", kwargs: {} },
        ])
    })
    it("LOGS AND ERRORS 2", async () => {
        const logs3 = await getLogs(page, "480aea45-da00-4e89-b43a-38e4d1827ec2")
        expect(logs3.length).toEqual(2)
        expect(logs3[0]).toEqual({ class: "Warn", description: "You should see the following error:", kwargs: {} })
        expect(logs3[1].class).toEqual("Error")
        expect(logs3[1].description).toContain("with_js_link")
        expect(logs3[1].kwargs.input).toEqual('"coOL"')
        expect(logs3[1].kwargs.exception).toContain("You should see this error COOL")
    })
    it("LOGS AND ERRORS 3: assertpackable", async () => {
        const logs = await getLogs(page, "b310dd30-dddd-4b75-81d2-aaf35c9dd1d3")
        expect(logs.length).toEqual(2)
        expect(logs[0]).toEqual({ class: "Warn", description: "You should see the assertpackable fail after this log", kwargs: {} })
        expect(logs[1].class).toEqual("Error")
        expect(logs[1].description).toContain("with_js_link")
        expect(logs[1].kwargs.input).toEqual('"4"')
        expect(logs[1].kwargs.exception).toContain("Only simple objects can be shared with JS")
    })

    it("globals", async () => {
        await expect_ev_output("globals", "54")
    })
    it("multiple in one cell", async () => {
        await expect_ev_output("uppercase", "ΠΑΝΑΓΙΏΤΗΣ")
        await expect_ev_output("lowercase", "παναγιώτης")

        await submit_ev_input("uppercase", "wOw")

        await expect_ev_output("uppercase", "WOW")
        await expect_ev_output("lowercase", "παναγιώτης")

        await submit_ev_input("lowercase", "drOEF")

        await expect_ev_output("uppercase", "WOW")
        await expect_ev_output("lowercase", "droef")
    })
    it("repeated", async () => {
        await expect_ev_output(`length[cellid="40031867-ee3c-4aa9-884f-b76b5a9c4dec"]`, "7")
        await expect_ev_output(`length[cellid="7f6ada79-8e3b-40b7-b477-ce05ae79a668"]`, "7")

        await submit_ev_input(`length[cellid="40031867-ee3c-4aa9-884f-b76b5a9c4dec"]`, "yay")

        await expect_ev_output(`length[cellid="40031867-ee3c-4aa9-884f-b76b5a9c4dec"]`, "3")
        await expect_ev_output(`length[cellid="7f6ada79-8e3b-40b7-b477-ce05ae79a668"]`, "7")
    })

    it("concurrency", async () => {
        await expect_ev_output("c1", "C1")
        await expect_ev_output("c2", "C2")

        await submit_ev_input("c1", "cc1")
        await submit_ev_input("c2", "cc2")

        await new Promise((resolve) => setTimeout(resolve, 4000))

        // NOT
        // they dont run in parallel so right now only cc1 should be finished
        // expect(await page.evaluate((s) => document.querySelector(s).textContent, ev_output_sel("c1"))).toBe("CC1")
        // expect(await page.evaluate((s) => document.querySelector(s).textContent, ev_output_sel("c2"))).toBe("C2")

        // await expect_ev_output("c1", "CC1")
        // await expect_ev_output("c2", "CC2")

        // they should run in parallel: after 4 seconds both should be finished
        expect(await page.evaluate((s) => document.querySelector(s).textContent, ev_output_sel("c1"))).toBe("CC1")
        expect(await page.evaluate((s) => document.querySelector(s).textContent, ev_output_sel("c2"))).toBe("CC2")
    })

    const expect_jslog = async (expected) => {
        // Use longer timeout for flaky test - 60 seconds instead of default 30
        expect(await waitForContentToBecome(page, "#checkme", expected, { timeout: 60000 })).toBe(expected)
    }
    it("js errors", async () => {
        await waitForPlutoToCalmDown(page)
        await new Promise((resolve) => setTimeout(resolve, 100))
        await expect_jslog("hello!")
        await page.click("#jslogbtn")
        await new Promise((resolve) => setTimeout(resolve, 500))
        await page.click("#jslogbtn")
        await new Promise((resolve) => setTimeout(resolve, 100))

        // We clicked twice, but sometimes it only registers one click for some reason. I don't care, so let's check for either.
        let prefix = await Promise.race([
            waitForContentToBecome(page, "#checkme", "hello!clickyay FRIETJE", { timeout: 60000 }),
            waitForContentToBecome(page, "#checkme", "hello!clickclickyay FRIETJEyay FRIETJE", { timeout: 60000 }),
        ])

        const yolotriggerid = "8782cc14-eb1a-48a8-a114-2f71f77be275"
        await page.click(`pluto-cell[id="${yolotriggerid}"] pluto-output input[type="button"]`)
        await expect_jslog(`${prefix}hello!`)
        await page.click("#jslogbtn")
        await expect_jslog(`${prefix}hello!clicknee exception in Julia callback:ErrorException("bad")`)

        await page.click("#jslogbtn")
        await new Promise((resolve) => setTimeout(resolve, 500))

        await page.click(`pluto-cell[id="${yolotriggerid}"] .runcell`)

        await expect_jslog(`${prefix}hello!clicknee exception in Julia callback:ErrorException("bad")clickhello!nee link not found`)
    })
})
