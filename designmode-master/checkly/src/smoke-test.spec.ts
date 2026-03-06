import type { Cookie } from "@playwright/test"
import { test } from "@playwright/test"
import { getEnv } from "./lib"

// Importing via relative path from node_modules is necessary to
// support bundling by the checkly CLI.
import { getPlaywrightAuthCookie } from "../node_modules/@spacemakerai/checkly-lib/auth.js"

let cookie: Cookie

test.beforeAll(async () => {
  cookie = await getPlaywrightAuthCookie(getEnv("APP_AUTH_BASE_URL"))
  // Support running against local URLs.
  cookie.domain = new URL(getEnv("APP_BASE_URL")).hostname
})

test.beforeEach(async ({ context }) => {
  await context.addCookies([cookie])
})

test("Smoke test designmode", async ({ page }, testInfo) => {
  await test.step("Go to proposal", async () => {
    test.setTimeout(120_000)

    await page.goto(`${getEnv("APP_BASE_URL")}/designmode/${getEnv("PROJECT_ID")}/${getEnv("PROPOSAL_ID")}`)
  })

  await test.step("Wait for proposal to be initialized", async () => {
    await page.waitForSelector("#designmode-initialized", {
      state: "attached",
      timeout: 60000,
    })

    await testInfo.attach("design-mode-initialized.png", {
      body: await page.screenshot({
        path: "design-mode-initialized.png",
      }),
      contentType: "image/png",
    })
  })

  await test.step("Wait for propopsal to be loaded", async () => {
    await page.waitForSelector("#designmode-loaded", {
      state: "attached",
      timeout: 60000,
    })

    await testInfo.attach("design-mode-loaded.png", {
      body: await page.screenshot({
        path: "design-mode-loaded.png",
      }),
      contentType: "image/png",
    })
  })

  // TODO: Do some simple thing to verify core behaviour
  // TODO: Verify scene is rendered
})
