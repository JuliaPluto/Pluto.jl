import puppeteer from "puppeteer"
import { saveScreenshot, createPage, paste, clickAndWaitForNavigation } from "../helpers/common"
import {
    importNotebook,
    getPlutoUrl,
    shutdownCurrentNotebook,
    setupPlutoBrowser,
    waitForPlutoToCalmDown,
    restartProcess,
    getCellIds,
    clearPlutoInput,
    writeSingleLineInPlutoInput,
    runAllChanged,
    openPathOrURLNotebook,
    getAllCellOutputs,
    gotoPlutoMainMenu,
} from "../helpers/pluto"

describe("safe_preview", () => {
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

    const expect_safe_preview = async (/** @type {import("puppeteer").Page} */ page) => {
        await waitForPlutoToCalmDown(page)
        expect(await page.evaluate(() => window.I_DID_SOMETHING_DANGEROUS)).toBeUndefined()
        await page.waitForSelector("pluto-editor.process_waiting_for_permission")
        expect(await page.evaluate(() => [...document.querySelector("pluto-editor").classList])).toContain("process_waiting_for_permission")
        expect(await page.evaluate(() => document.querySelector("a#restart-process-button"))).not.toBeNull()
        expect(await page.evaluate(() => document.querySelector(".safe-preview-info"))).not.toBeNull()
    }

    it("Pasting notebook contents should open in safe preview", async () => {
        await Promise.all([
            page.waitForNavigation(),
            paste(
                page,
                `### A Pluto.jl notebook ###
# v0.14.0

using Markdown
using InteractiveUtils

# ╔═╡ b2d786ec-7f73-11ea-1a0c-f38d7b6bbc1e
md"""
Hello
"""

# ╔═╡ b2d79330-7f73-11ea-0d1c-a9aad1efaae1
1 + 2

# ╔═╡ Cell order:
# ╟─b2d786ec-7f73-11ea-1a0c-f38d7b6bbc1e
# ╠═b2d79330-7f73-11ea-0d1c-a9aad1efaae1
`
            ),
        ])
        await expect_safe_preview(page)
    })

    it("Notebook from URL source", async () => {
        const url = "https://raw.githubusercontent.com/fonsp/Pluto.jl/v0.14.5/sample/Basic.jl"

        await openPathOrURLNotebook(page, url, { permissionToRunCode: false })
        await expect_safe_preview(page)

        let expectWarningMessage = async () => {
            await page.waitForSelector(`a#restart-process-button`)
            const [dmsg, _] = await Promise.all([
                new Promise((res) => {
                    page.once("dialog", async (dialog) => {
                        let msg = dialog.message()
                        await dialog.dismiss()
                        res(msg)
                    })
                }),
                page.click(`a#restart-process-button`),
            ])

            expect(dmsg).toContain(url)
            expect(dmsg.toLowerCase()).toContain("danger")
            expect(dmsg.toLowerCase()).toContain("are you sure")

            await new Promise((resolve) => setTimeout(resolve, 1000))
            await waitForPlutoToCalmDown(page)
            await expect_safe_preview(page)
        }

        await expectWarningMessage()

        // Make some edits
        expect((await getAllCellOutputs(page))[0]).toContain("Basel problem")

        let sel = `pluto-cell[id="${(await getCellIds(page))[0]}"]`
        await page.click(`${sel} .foldcode`)

        await clearPlutoInput(page, sel)
        await writeSingleLineInPlutoInput(page, sel, "1 + 1")
        await runAllChanged(page)

        expect((await getAllCellOutputs(page))[0]).toBe("Code not executed in Safe preview")
        await expect_safe_preview(page)

        //////////////////////////
        // Let's shut it down
        // @ts-ignore
        let path = await page.evaluate(() => window.editor_state.notebook.path.replaceAll("\\", "\\\\"))
        let shutdown = async () => {
            await shutdownCurrentNotebook(page)
            await gotoPlutoMainMenu(page)
            // Wait for it to be shut down
            await page.waitForSelector(`li.recent a[title="${path}"]`)
        }
        await shutdown()

        // Run it again
        await clickAndWaitForNavigation(page, `a[title="${path}"]`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await waitForPlutoToCalmDown(page)

        await expect_safe_preview(page)
        await expectWarningMessage()

        ////////////////////
        await shutdown()

        // Now let's try to run the notebook in the background. This should start it in safe mode because of the risky source
        await page.evaluate((path) => {
            let a = document.querySelector(`a[title="${path}"]`)
            let btn = a.previousElementSibling
            btn.click()
        }, path)

        await page.waitForSelector(`li.running a[title="${path}"]`)
        await clickAndWaitForNavigation(page, `a[title="${path}"]`)

        await expect_safe_preview(page)
        await expectWarningMessage()

        // Let's run it
        await Promise.all([
            new Promise((res) => {
                page.once("dialog", (dialog) => {
                    res(dialog.accept())
                })
            }),
            page.click(`a#restart-process-button`),
        ])
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await waitForPlutoToCalmDown(page)

        // Nice
        expect((await getAllCellOutputs(page))[0]).toBe("2")

        ////////////////////
        await shutdown()

        await clickAndWaitForNavigation(page, `a[title="${path}"]`)

        await expect_safe_preview(page)
        expect((await getAllCellOutputs(page))[0]).toBe("Code not executed in Safe preview")

        // Since we ran the notebook once, there should be no warning message:
        await page.waitForSelector(`a#restart-process-button`)
        await page.click(`a#restart-process-button`)

        // If there was a dialog, we would stall right now and the test would fail.
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await waitForPlutoToCalmDown(page)
        expect((await getAllCellOutputs(page))[0]).toBe("2")
    })

    it("Importing notebook should open in safe preview", async () => {
        await importNotebook(page, "safe_preview.jl", { permissionToRunCode: false })
        await expect_safe_preview(page)

        await waitForPlutoToCalmDown(page)

        let cell_contents = await getAllCellOutputs(page)

        expect(cell_contents[0]).toBe("one")
        expect(cell_contents[1]).toBe("Scripts and styles not rendered in Safe preview\n\ni should not be red\n\n\n\ntwo\n\n\nsafe")
        expect(cell_contents[2]).toBe("three")
        expect(cell_contents[3]).toBe("Code not executed in Safe preview")
        expect(cell_contents[4]).toBe("Code not executed in Safe preview")
        expect(cell_contents[5]).toContain("yntax")
        expect(cell_contents[6]).toBe("")

        expect(await page.evaluate(() => getComputedStyle(document.querySelector(`.zo`)).color)).not.toBe("rgb(255, 0, 0)")

        // Modifying should not execute code
        const cellids = await getCellIds(page)
        let sel = `pluto-cell[id="${cellids[0]}"] pluto-input`

        let expectNewOutput = async (contents) => {
            await clearPlutoInput(page, sel)
            await writeSingleLineInPlutoInput(page, sel, contents)
            await runAllChanged(page)
            return expect((await getAllCellOutputs(page))[0])
        }

        ;(await expectNewOutput(`md"een"`)).toBe("een")
        ;(await expectNewOutput(`un`)).toBe("Code not executed in Safe preview")
        ;(await expectNewOutput(`md"one"`)).toBe("one")
        ;(await expectNewOutput(`a b c function`)).toContain("yntax")
        ;(await expectNewOutput(`md"one"`)).toBe("one")
        ;(await expectNewOutput(``)).toBe("")
        ;(await expectNewOutput(`md"one"`)).toBe("one")

        await restartProcess(page)
        await waitForPlutoToCalmDown(page)

        cell_contents = await getAllCellOutputs(page)

        expect(cell_contents[0]).toBe("one")
        expect(cell_contents[1]).toBe("\ni should not be red\n\ntwo\nsafe\nDANGER")
        expect(cell_contents[2]).toBe("three")
        expect(cell_contents[3]).toBe("123")
        expect(cell_contents[4]).toBe("")
        expect(cell_contents[5]).toContain("yntax")
        expect(cell_contents[6]).toBe("")

        expect(await page.evaluate(() => document.querySelector(`pluto-log-dot`).innerText)).toBe("four\nDANGER")

        expect(await page.evaluate(() => getComputedStyle(document.querySelector(`.zo`)).color)).toBe("rgb(255, 0, 0)")
    })

    it("Static preview is sanitized when the statefile comes from URL parameters", async () => {
        await importNotebook(page, "safe_preview.jl", { permissionToRunCode: true })
        await waitForPlutoToCalmDown(page)
        expect(await page.evaluate(() => window.I_DID_SOMETHING_DANGEROUS)).toBe(true)

        // @ts-ignore
        const notebook_id = await page.evaluate(() => window.editor_state.notebook.notebook_id)
        const statefile_url = `${getPlutoUrl()}/statefile?id=${notebook_id}`

        const preview = await createPage(browser)
        try {
            await preview.goto(`${getPlutoUrl()}/edit?statefile=${encodeURIComponent(statefile_url)}`)
            await preview.waitForSelector("pluto-editor.static_preview pluto-cell pluto-output .zo")
            expect(await preview.evaluate(() => [...document.querySelector("pluto-editor").classList])).toContain("sanitize_html")
            expect(await preview.evaluate(() => window.I_DID_SOMETHING_DANGEROUS)).toBeUndefined()
            expect(await preview.evaluate(() => getComputedStyle(document.querySelector(`.zo`)).color)).not.toBe("rgb(255, 0, 0)")

            // An exported HTML file sets its launch parameters as globals instead.
            await preview.evaluateOnNewDocument((url) => {
                // @ts-ignore
                window.pluto_statefile = url
            }, statefile_url)
            await preview.goto(`${getPlutoUrl()}/edit`)
            await preview.waitForSelector("pluto-editor.static_preview pluto-cell pluto-output .zo")
            await preview.waitForFunction(() => window.I_DID_SOMETHING_DANGEROUS === true)
            expect(await preview.evaluate(() => [...document.querySelector("pluto-editor").classList])).not.toContain("sanitize_html")
            expect(await preview.evaluate(() => getComputedStyle(document.querySelector(`.zo`)).color)).toBe("rgb(255, 0, 0)")
        } finally {
            await preview.close()
        }
    })
})
