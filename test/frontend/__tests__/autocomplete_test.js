import puppeteer from "puppeteer"
import { lastElement, saveScreenshot, createPage, waitForContentToBecome } from "../helpers/common"
import {
    getCellIds,
    importNotebook,
    waitForCellOutput,
    getPlutoUrl,
    writeSingleLineInPlutoInput,
    shutdownCurrentNotebook,
    setupPlutoBrowser,
    gotoPlutoMainMenu,
    clearPlutoInput,
} from "../helpers/pluto"

describe("PlutoAutocomplete", () => {
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

    it("should get the correct autocomplete suggestions", async () => {
        await importNotebook(page, "autocomplete_notebook.jl")
        const importedCellIds = await getCellIds(page)
        await Promise.all(importedCellIds.map((cellId) => waitForCellOutput(page, cellId)))

        // Add a new cell
        let lastPlutoCellId = lastElement(importedCellIds)
        await page.click(`pluto-cell[id="${lastPlutoCellId}"] .add_cell.after`)
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Type the partial input

        const clear_and_type = async (/** @type {string} */ text) => {
            lastPlutoCellId = lastElement(await getCellIds(page))
            const pi_sel = `pluto-cell[id="${lastPlutoCellId}"] pluto-input`

            await clearPlutoInput(page, pi_sel)
            await new Promise((resolve) => setTimeout(resolve, 500))

            // Type input
            await writeSingleLineInPlutoInput(page, pi_sel, text)
            await new Promise((resolve) => setTimeout(resolve, 500))
        }
        await clear_and_type("my_su")

        const get_completions = async () => {
            // Wait for the autocomplete suggestions to appear by itself
            await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 10 * 1000 }).catch(async () => {
                // If the autocomplete suggestions don't appear, we need let's trigger it manually
                await page.keyboard.press("Tab")
                await page.waitForSelector(".cm-tooltip-autocomplete")
            })

            // Get suggestions
            return page.evaluate(() => Array.from(document.querySelectorAll(".cm-tooltip-autocomplete li")).map((suggestion) => suggestion.textContent))
        }

        let suggestions = await get_completions()
        suggestions.sort()
        expect(suggestions).toEqual(["my_subtract", "my_sum1", "my_sum2"])

        /////////////////
        //// Next, test Base functions

        await clear_and_type("nextfloa")
        expect((await get_completions()).sort()).toEqual(["nextfloat"])

        await clear_and_type("soerror")
        expect((await get_completions()).sort()).toContain("StackOverflowError")
        expect((await get_completions()).sort()).toContain("showerror")

        ////////////
        /// Test fuzzy

        await clear_and_type("idxcrs")
        expect((await get_completions()).sort()).toEqual(["IndexCartesian"])
    })
})
