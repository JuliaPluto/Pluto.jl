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
        lastPlutoCellId = lastElement(await getCellIds(page))
        await writeSingleLineInPlutoInput(page, `pluto-cell[id="${lastPlutoCellId}"] pluto-input`, "my_su")
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Wait for the autocomplete suggestions to appear by itself
        await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 10 * 1000 }).catch(async () => {
            // If the autocomplete suggestions don't appear, we need let's trigger it manually
            await page.keyboard.press("Tab")
            await page.waitForSelector(".cm-tooltip-autocomplete")
        })

        // Get suggestions
        const suggestions = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".cm-tooltip-autocomplete li")).map((suggestion) => suggestion.textContent)
        )
        suggestions.sort()
        expect(suggestions).toEqual(["my_subtract", "my_sum1", "my_sum2"])
    })

    // Skipping because this doesn't work with FuzzyCompletions anymore
    it.skip("should automatically autocomplete if there is only one possible suggestion", async () => {
        await importNotebook(page, "autocomplete_notebook.jl")
        const importedCellIds = await getCellIds(page)
        await Promise.all(importedCellIds.map((cellId) => waitForCellOutput(page, cellId)))

        // Add a new cell
        let lastPlutoCellId = lastElement(importedCellIds)
        await page.click(`pluto-cell[id="${lastPlutoCellId}"] .add_cell.after`)
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Type the partial input
        lastPlutoCellId = lastElement(await getCellIds(page))
        await writeSingleLineInPlutoInput(page, `pluto-cell[id="${lastPlutoCellId}"] pluto-input`, "my_sub")

        // Trigger autocomplete
        await page.keyboard.press("Tab")

        expect(await waitForContentToBecome(page, `pluto-cell[id="${lastPlutoCellId}"] pluto-input .CodeMirror-line`, "my_subtract")).toBe("my_subtract")
    })
})
