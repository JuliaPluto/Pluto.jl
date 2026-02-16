import { createPage, saveScreenshot } from "../helpers/common"
import { setupPlutoBrowser, gotoPlutoMainMenu, createNewNotebook, shutdownCurrentNotebook, getPlutoUrl } from "../helpers/pluto"

const describeWithPort = process.env.PLUTO_PORT ? describe : describe.skip

describeWithPort("rtl_and_i18n", () => {
    /** @type {import("puppeteer").Browser} */
    let browser = null
    /** @type {import("puppeteer").Page} */
    let page = null

    const waitForMenuReady = async (page) => {
        await page.waitForFunction(() => document.querySelector(`.not_yet_ready`) == null)
    }

    const gotoMainMenuWithQuery = async (page, query = "") => {
        await page.goto(`${getPlutoUrl()}${query}`, { waitUntil: "domcontentloaded" })
        await waitForMenuReady(page)
    }

    beforeAll(async () => {
        browser = await setupPlutoBrowser()
    })

    beforeEach(async () => {
        page = await createPage(browser)
    })

    afterEach(async () => {
        if (page == null) return
        await saveScreenshot(page)
        try {
            await shutdownCurrentNotebook(page)
        } catch (_error) {
            // This test file does not always open a notebook.
        }
        await page.close()
        page = null
    })

    afterAll(async () => {
        if (browser == null) return
        await browser.close()
        browser = null
    })

    it("applies direction overrides with query > localStorage > locale", async () => {
        await gotoMainMenuWithQuery(page)
        expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr")

        await page.evaluate(() => localStorage.setItem("pluto_ui_direction_override", "rtl"))
        await gotoMainMenuWithQuery(page)
        expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl")

        await gotoMainMenuWithQuery(page, "?pluto_ui_dir=ltr")
        expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr")

        await gotoMainMenuWithQuery(page, "?pluto_ui_dir=rtl")
        expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl")

        await page.evaluate(() => localStorage.removeItem("pluto_ui_direction_override"))
        await gotoMainMenuWithQuery(page)
        expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr")
    })

    it("renders welcome shell in RTL without forced LTR wrappers", async () => {
        await gotoMainMenuWithQuery(page, "?pluto_ui_dir=rtl")

        const shell = await page.evaluate(() => {
            const newSection = document.querySelector("#new")
            const featuredSection = document.querySelector("section#featured")
            const openSectionTitle = document.querySelector("section#open h2")

            return {
                htmlDir: document.documentElement.dir,
                newSectionDirAttribute: newSection?.getAttribute("dir") ?? null,
                featuredDirAttribute: featuredSection?.getAttribute("dir") ?? null,
                newSectionDirection: newSection ? getComputedStyle(newSection).direction : null,
                featuredDirection: featuredSection ? getComputedStyle(featuredSection).direction : null,
                openSectionTitle: openSectionTitle?.textContent ?? "",
            }
        })

        expect(shell.htmlDir).toBe("rtl")
        expect(shell.newSectionDirAttribute).toBeNull()
        expect(shell.featuredDirAttribute).toBeNull()
        expect(shell.newSectionDirection).toBe("rtl")
        expect(shell.featuredDirection).toBe("rtl")
        expect(shell.openSectionTitle.length).toBeGreaterThan(0)
    })

    it("keeps code surfaces LTR while editor chrome runs under RTL", async () => {
        await gotoPlutoMainMenu(page)
        await page.evaluate(() => localStorage.setItem("pluto_ui_direction_override", "rtl"))
        await createNewNotebook(page)

        await page.waitForSelector("pluto-input .cm-editor", { visible: true })
        await page.waitForFunction(() => document.querySelector("dialog.big-pkg-terminal pkg-terminal") != null)

        const directions = await page.evaluate(() => {
            const editor = document.querySelector("pluto-input .cm-editor")
            const pkgTerminal = document.querySelector("dialog.big-pkg-terminal pkg-terminal")

            return {
                htmlDir: document.documentElement.dir,
                codeEditorDirection: editor ? getComputedStyle(editor).direction : null,
                pkgTerminalDirAttr: pkgTerminal?.getAttribute("dir") ?? null,
            }
        })

        expect(directions.htmlDir).toBe("rtl")
        expect(directions.codeEditorDirection).toBe("ltr")
        expect(directions.pkgTerminalDirAttr).toBe("ltr")

        await page.click("pluto-input > button")
        await page.waitForSelector("pluto-input > div.input_context_menu", { visible: true })

        const menuBounds = await page.evaluate(() => {
            const menu = document.querySelector("pluto-input > div.input_context_menu")
            if (!menu) return null
            const rect = menu.getBoundingClientRect()
            return {
                left: rect.left,
                right: rect.right,
                width: rect.width,
                viewportWidth: window.innerWidth,
            }
        })

        expect(menuBounds).not.toBeNull()
        expect(menuBounds.width).toBeGreaterThan(0)
        expect(menuBounds.left).toBeGreaterThanOrEqual(0)
        expect(menuBounds.right).toBeLessThanOrEqual(menuBounds.viewportWidth + 1)

        await page.evaluate(() => localStorage.removeItem("pluto_ui_direction_override"))
    })
})
