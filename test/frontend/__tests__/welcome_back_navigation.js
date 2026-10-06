import path from "path"
import { createPage, getArtifactsDir, saveScreenshot } from "../helpers/common"
import { gotoPlutoMainMenu, setupPlutoBrowser } from "../helpers/pluto"

describe("Welcome page back navigation", () => {
    /** @type {import("puppeteer").Browser} */
    let browser = null
    /** @type {import("puppeteer").Page} */
    let page = null

    const missing_notebook_path = path.join(getArtifactsDir(), "this notebook does not exist.jl")
    const recent_link_selector = `#mywork a[title="${missing_notebook_path}"]`

    beforeAll(async () => {
        browser = await setupPlutoBrowser()
    })
    beforeEach(async () => {
        page = await createPage(browser)
        await gotoPlutoMainMenu(page)
        await page.evaluate((p) => localStorage.setItem("recent notebooks", JSON.stringify([p])), missing_notebook_path)
        await gotoPlutoMainMenu(page)
        await page.waitForSelector(recent_link_selector)
    })
    afterEach(async () => {
        await saveScreenshot(page)
        await page.evaluate(() => localStorage.removeItem("recent notebooks"))
        await page.close()
        page = null
    })
    afterAll(async () => {
        await browser.close()
        browser = null
    })

    it("should hide the loading screen when the page is restored from the back/forward cache", async () => {
        // Run the link's click handler, but stay on the page.
        await page.evaluate(() => document.addEventListener("click", (e) => e.preventDefault(), { capture: true, once: true }))
        await page.click(recent_link_selector)
        await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
        await page.waitForSelector(".navigating-away-banner")

        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))
        await page.waitForSelector(recent_link_selector)
        expect(await page.$(".navigating-away-banner")).toBeNull()
    })

    it("should show the main menu after going back from a notebook that can't be opened", async () => {
        await Promise.all([page.waitForNavigation(), page.click(recent_link_selector)])
        expect(page.url()).toContain("/open?path=")

        await page.goBack()
        await page.waitForSelector(recent_link_selector)
        expect(await page.$(".navigating-away-banner")).toBeNull()
    })
})
