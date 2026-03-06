import type { Cookie } from "@playwright/test"
import { test } from "@playwright/test"
import { getEnv } from "../lib"

// Importing via relative path from node_modules is necessary to
// support bundling by the checkly CLI.
import { getPlaywrightAuthCookie } from "../../node_modules/@spacemakerai/checkly-lib/auth.js"

let cookie: Cookie

test.beforeAll(async () => {
  cookie = await getPlaywrightAuthCookie(getEnv("APP_AUTH_BASE_URL"))
  // Support running against local URLs.
  cookie.domain = new URL(getEnv("APP_BASE_URL")).hostname
})

test.beforeEach(async ({ context }) => {
  await context.addCookies([cookie])
})

test("3d sketch smoke", async ({ page }, testInfo) => {
  await test.step("Go to proposal", async () => {
    test.setTimeout(120_000)

    await page.goto(`${getEnv("APP_BASE_URL")}/designmode/${getEnv("PROJECT_ID")}/${getEnv("PROPOSAL_ID")}`)
  })

  await test.step("Start and exit 3d sketch", async () => {
    await page.waitForSelector("forma-toolbar-button#conceptual", {
      state: "attached",
      timeout: 120000,
    })
    await page.locator("forma-toolbar-button#conceptual").getByRole("img").click()

    // Wait for line tool button to display
    await page.waitForSelector("forma-toolbar-button#Line-button", {
      state: "attached",
      timeout: 30000,
    })

    // Take screenshot
    await testInfo.attach("3d-sketch-smoke-3ds-mode-loaded.png", {
      body: await page.screenshot({
        path: "./test-results/3d-sketch/smoke-3ds-mode-loaded.png",
      }),
      contentType: "image/png",
    })

    // Exit 3d sketch
    await page.locator("forma-toolbar-close-button").getByRole("button").click()
  })
})
