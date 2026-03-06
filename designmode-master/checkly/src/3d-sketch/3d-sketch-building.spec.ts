import type { Cookie } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { getEnv } from "../lib"

// Importing via relative path from node_modules is necessary to
// support bundling by the checkly CLI.
import { getPlaywrightAuthCookie } from "../../node_modules/@spacemakerai/checkly-lib/auth.js"
import { createTestProposal, deleteTestProposal } from "../../local/lib"

// Note: Checkly overrides Playwright config, so we need explicit timeouts on assertions

let cookie: Cookie

test.beforeAll(async () => {
  cookie = await getPlaywrightAuthCookie(getEnv("APP_AUTH_BASE_URL"))
  // Support running against local URLs.
  cookie.domain = new URL(getEnv("APP_BASE_URL")).hostname
})

test.beforeEach(async ({ context }) => {
  await context.addCookies([cookie])
})

test("3d sketch building", async ({ page }, testInfo) => {
  test.setTimeout(240000)
  // Set default timeout for all actions
  page.setDefaultTimeout(60_000)

  // Accept any dialogs that appear
  page.on("dialog", (dialog) => dialog.accept())

  await test.step("Go to proposal", async () => {
    const projectId = "pro_z97z4jqlcd"
    const proposalId = "0596cf51-8acd-4707-839c-e492e101631a"

    // Create a test/duplicate proposal
    await createTestProposal(page, projectId, proposalId, true)
  })

  await test.step("Start 3d sketch", async () => {
    // Start 3d sketch
    await page.locator("forma-toolbar-button#conceptual").getByRole("img").click()
    // Wait for line tool button to display
    await page.waitForSelector("forma-toolbar-button#Line-button", {
      state: "attached",
      timeout: 60000,
    })
    // Screenshot 3d sketch mode loaded
    await testInfo.attach("3d-sketch-building-3ds-mode-loaded.png", {
      body: await page.screenshot({
        path: "./test-results/3d-sketch/building-3ds-mode-loaded.png",
      }),
      contentType: "image/png",
    })

    // Verify clean slate
    expect(await page.screenshot({ clip: { x: 327, y: 160, width: 617, height: 484 } })).toMatchSnapshot(
      `clean-dm.png`,
      {
        maxDiffPixelRatio: 0.0001,
      },
    )
  })

  await test.step("Create 3d sketch building", async () => {
    // Start cube primitive tool
    await page.evaluate(() => {
      // Use eval to avoid Playwright type checking
      eval("FormIt.Tools.StartTool(FormIt.ToolType.CREATE_CUBE)")
    })
    await page.waitForTimeout(1000)

    // Place cube
    await page.mouse.click(641, 391)

    console.log("Waiting for Add floors button")
    await page.waitForSelector('[id="AddFloors"]', {
      state: "attached",
      timeout: 60000,
    })

    // Screenshot drawing
    await testInfo.attach("3d-sketch-building-drawn.png", {
      body: await page.screenshot({
        path: "./test-results/3d-sketch/building-drawn.png",
      }),
      contentType: "image/png",
    })
  })

  await test.step("Add floors to 3d building", async () => {
    console.log("Clicking Add floors button")
    // Add floors
    // await page.getByRole("complementary").getByRole("button").click()
    await page.locator('[id="AddFloors"]').getByRole("button").click()

    console.log("Waiting for floor plans to display")
    // Wait for floor plans to be visible (indicates the building/floors are saved)
    await expect(page.getByText("Floor plans")).toBeVisible()

    // Wait a second
    await page.waitForTimeout(1000)

    // Screenshot the created building in 3d sketch
    await testInfo.attach("3d-sketch-building-saved-3ds.png", {
      body: await page.screenshot({
        path: "./test-results/3d-sketch/building-saved-3ds.png",
      }),
      contentType: "image/png",
    })

    // Compare screenshot for any camera issues
    expect(await page.screenshot({ clip: { x: 327, y: 160, width: 617, height: 484 } })).toMatchSnapshot(
      `saved-3ds.png`,
      {
        maxDiffPixelRatio: 0.0001,
      },
    )
  })

  await test.step("Check 3d sketch building size", async () => {
    await expect(page.locator("#area")).toContainText("1,600 ft²", { timeout: 30000 })

    console.log("Exit 3d sketch mode")
    // Exit 3d sketch
    await page.locator("forma-toolbar-close-button").getByRole("button").click()

    // Verify the Edit in 3d sketch button exists
    await expect(page.getByRole("button", { name: "Edit in 3D Sketch" })).toBeVisible({ timeout: 10000 })

    // Check the area metrics value from outside 3d sketch
    await expect(page.locator("#area")).toContainText("1,600 ft²", { timeout: 30000 })

    // Screenshot the newly created building
    await testInfo.attach("3d-sketch-building-verified-dm.png", {
      body: await page.screenshot({
        path: "./test-results/3d-sketch/building-verified-dm.png",
      }),
      contentType: "image/png",
    })
  })

  await test.step("Verify building after reload", async () => {
    // Change this value to the expected BC area of the building
    const checkArea = "1,600 ft²"

    // Wait for a save to finish
    await page.waitForTimeout(10000)

    // Reload the page
    await page.reload()
    await page.waitForSelector("forma-toolbar-button#conceptual", {
      state: "attached",
      timeout: 60000,
    })

    // Screenshot the newly created building
    await testInfo.attach("3d-sketch-building-verified-reload.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/building-verified-reload.png`,
      }),
      contentType: "image/png",
    })

    await page.waitForTimeout(1000)

    // Click the element
    await page.mouse.click(642, 381)

    // Check building size from outside 3d sketch
    await expect(page.locator("#area")).toContainText(checkArea, { timeout: 30000 })

    // Start 3d sketch
    await page.locator("forma-toolbar-button#conceptual-edit").getByRole("img").click()

    // Verify the Floor details appear
    await expect(page.getByText("Floor details")).toBeVisible({ timeout: 5000 })

    // Check the area metrics value from inside 3d sketch
    await expect(page.locator("#area")).toContainText(checkArea, {
      timeout: 30000,
    })

    // Screenshot the newly created building
    await testInfo.attach("3d-sketch-building-verified-reload-3ds.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/building-verified-reload-3ds.png`,
      }),
      contentType: "image/png",
    })

    // Exit 3d sketch
    await page.locator("forma-toolbar-close-button").getByRole("button").click()
    await page.waitForTimeout(1000)
  })

  await test.step("Delete 3d sketch building", async () => {
    // Press the delete button
    await page.keyboard.press("Delete")

    // Check if it was deleted
    await expect(page.getByText("Floor plans")).not.toBeVisible()

    // Wait for delete
    await page.waitForTimeout(1000)

    // Screenshot the deleted building
    await testInfo.attach("3d-sketch-building-x-deleted.png", {
      body: await page.screenshot({
        path: "./test-results/3d-sketch/building-x-deleted.png",
      }),
      contentType: "image/png",
    })
  })

  await test.step("Delete test proposal", async () => {
    // Delete the test/duplicate proposal
    await deleteTestProposal(page)
  })
})
