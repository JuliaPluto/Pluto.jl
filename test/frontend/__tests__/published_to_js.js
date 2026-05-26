import puppeteer from "puppeteer"
import { saveScreenshot, createPage } from "../helpers/common"
import { importNotebook, getPlutoUrl, shutdownCurrentNotebook, setupPlutoBrowser, gotoPlutoMainMenu } from "../helpers/pluto"

describe("published_to_js", () => {
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
    })
    beforeEach(async () => {
        page = await createPage(browser)
        await gotoPlutoMainMenu(page)
    })
    afterEach(async () => {
        await saveScreenshot(page)
        await shutdownCurrentNotebook(page)
        await page.close()
        page = null
    })
    afterAll(async () => {
        await browser.close()
        browser = null
    })

    it("Should correctly show published_to_js in cell output, and in logs", async () => {
        await importNotebook(page, "published_to_js.jl", { timeout: 120 * 1000 })

        let output_of_published = await page.evaluate(() => {
            return document.querySelector("#to_cell_output")?.textContent
        })
        expect(output_of_published).toBe("[1,2,3] MAGIC!")

        // The log content is not shown, so #to_cell_log does not exist
        let log_of_published = await page.evaluate(() => {
            return document.querySelector("#to_cell_log")?.textContent
        })
        // This test is currently broken, due to https://github.com/fonsp/Pluto.jl/issues/2092
        expect(log_of_published).toBe("[4,5,6] MAGIC!")

        // @embed of an array: cell output text should contain "Hello" and the array value "999"
        const array_embed_text = await page.evaluate(() => {
            return /** @type {HTMLElement?} */ (
                document.querySelector(`pluto-cell[id="83162255-9579-46c3-9fb7-f6e2cfc1b4bf"] pluto-output`)
            )?.innerText
        })
        expect(array_embed_text).toContain("Hello")
        expect(array_embed_text).toContain("999")

        // The embedded array should render through Pluto's display pipeline:
        // a <pluto-display> wraps the embedded content, and a <pluto-tree> renders the array.
        const array_embed_has_components = await page.evaluate(() => {
            const host = document.querySelector("#array_embedded_here")
            return {
                hasDisplay: host?.querySelector("pluto-display") != null,
                hasTree: host?.querySelector("pluto-tree") != null,
            }
        })
        expect(array_embed_has_components.hasDisplay).toBe(true)
        expect(array_embed_has_components.hasTree).toBe(true)

        // @embed of an @htl HTML snippet
        const html_embed_text = await page.evaluate(() => {
            return /** @type {HTMLElement?} */ (document.querySelector("#html_embedded_here"))?.innerText
        })
        expect(html_embed_text).toBe("Hello Yay")

        // ReactDOMElement with mixed children (HTML, array, nested ReactDOMElement)
        const reactdom_text = await page.evaluate(() => {
            return /** @type {HTMLElement?} */ (document.querySelector(`pluto-cell[id="564ac630-e026-414f-aa63-52bda74769f0"] pluto-output`))?.innerText
        })
        expect(reactdom_text).toContain("onetwo")
        expect(reactdom_text).toContain("33")
        expect(reactdom_text).not.toContain("3344") // without whitespace
        expect(reactdom_text).toContain("coolbeanz")
    })
})
