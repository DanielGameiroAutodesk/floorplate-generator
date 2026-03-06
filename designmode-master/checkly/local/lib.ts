import { expect, type Page, type TestInfo } from "@playwright/test"
import { createHash } from "crypto"
import { getEnv } from "../src/lib"
import { getPlaywrightAuthCookie } from "../node_modules/@spacemakerai/checkly-lib/auth"

// Constants for selectors
export const I3DS_CREATE_SELECTOR = "forma-toolbar-button#conceptual"
export const I3DS_EDIT_SELECTOR = "forma-toolbar-button#conceptual-edit"
export const CONVERT_TO_I3DS_SELECTOR = "#edit-building-in-3d-sketch"
export const RIGHT_MENU_EDIT_3DS_SELECTOR = "#edit-in-3d-sketch"
export const LINE_TOOL_SELECTOR = "forma-toolbar-button#Line-button"
export const CLOSE_BUTTON_SELECTOR = "forma-toolbar-close-button"

// Main project and proposal IDs
// Local link: https://local.autodeskforma.eu:3000/designmode/pro_lze2pawcjj/cf18d3b6-f742-4362-9f41-3e292ae60570
// Production link: https://app.autodeskforma.eu/designmode/pro_lze2pawcjj/cf18d3b6-f742-4362-9f41-3e292ae60570
export const mainProjectId = "pro_lze2pawcjj"
export const mainProposalId = "cf18d3b6-f742-4362-9f41-3e292ae60570"

// Initialize the page with the auth cookie
export async function init(page: Page) {
  const cookie = await getPlaywrightAuthCookie(getEnv("APP_AUTH_BASE_URL"))
  // Support running against local URLs.
  cookie.domain = new URL(getEnv("APP_BASE_URL")).hostname

  // Get the page context
  const context = page.context()

  // Check if the cookie is already set
  if ((await context.cookies()).length > 0) return page

  // Otherwise, add the cookie
  await context.addCookies([cookie])

  // Slow down the page if CPUTHROTTLE is set
  if (process.env.CPUTHROTTLE) {
    const cdpSession = await context.newCDPSession(page)
    await cdpSession.send("Emulation.setCPUThrottlingRate", {
      rate: parseInt(process.env.CPUTHROTTLE),
    })
  }

  // Accept any dialogs that appear
  page.on("dialog", (dialog) => dialog.accept())

  // Set default timeout for all locators
  page.setDefaultTimeout(60_000)

  return page
}

// Create a test proposal
export async function createTestProposal(
  page: Page,
  projectId = mainProjectId,
  proposalId = mainProposalId,
  noPageClose = false,
) {
  // Check if the proposal has already been duplicated
  if (process.env.PROPOSAL_DUPE_ID) return console.error("Proposal already duplicated")
  // Goto the proposal
  await page.goto(`${getEnv("APP_BASE_URL")}/designmode/${projectId}/${proposalId}`, { timeout: 60000 })

  // Ensure there's at most ten proposals (3 regions (Ireland, Sydney and North Virginia) + future buffer)
  await page.waitForSelector("weave-tile", { timeout: 60000 })
  const tileCount = await page.locator("weave-tile").count()
  expect(tileCount).toBeLessThanOrEqual(10)

  // Duplicate the proposal
  await page.locator("weave-tile").filter({ hasText: "DO NOT EDIT" }).last().hover()
  await page
    .locator("weave-tile")
    .filter({ hasText: "DO NOT EDIT" })
    .last()
    .locator("weave-tripple-dot")
    .getByRole("img")
    .click()
  console.log("Duplicating proposal")
  await page.getByRole("button", { name: "Duplicate" }).click()

  await expect(page.locator("weave-tile").filter({ hasText: "DO NOT EDIT copy" })).toBeVisible({
    timeout: 30000,
  })

  // Get the duplicate proposal id
  const url = new URL(page.url())

  // Set the proposal id to the environment variable PROPOSAL_ID
  const testProposalId = url.pathname.split("/").pop()
  // Generate a short, unique identifier for the proposal name by hashing the proposal ID with MD5
  // and truncating the result to the first 8 characters. This is used for naming purposes only
  // and does not require cryptographic security.
  const testProposalName = createHash("md5").update(testProposalId!).digest("hex").substring(0, 8)
  process.env.PROPOSAL_DUPE_ID = testProposalId
  process.env.PROPOSAL_DUPE_NAME = testProposalName
  expect(process.env.PROPOSAL_DUPE_ID).not.toBeFalsy()
  expect(testProposalId).not.toEqual(mainProposalId)

  // Rename the duplicated proposal
  await page.locator("h3").filter({ hasText: "DO NOT EDIT copy" }).first().dblclick()
  await page.waitForTimeout(1000)
  await page.keyboard.type(testProposalName)

  // Press enter to save the new name
  await page.keyboard.press("Enter")
  await page.waitForTimeout(3000)

  // Screenshot duplicated proposal
  await page.screenshot({
    path: `./test-results/3d-sketch/proposal-dupe.png`,
  })

  if (!noPageClose) {
    // Close the page
    await page.close()
  }
}

// Helper function to delete a proposal with retry mechanism
async function deleteProposalWithRetry(page: Page, proposalName: string): Promise<boolean> {
  const maxRetries = 5
  const retryDelay = 10000 // 10 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Deletion attempt ${attempt}/${maxRetries} for proposal: ${proposalName}`)

      // Find and hover over the proposal tile to delete
      const tile = page.locator("weave-tile").filter({ hasText: proposalName }).first()
      await tile.hover()

      // Click the three-dot menu
      await tile.locator("weave-tripple-dot").getByRole("img").click()

      // Click the Delete button
      console.log("Clicking delete button")
      await page.getByRole("button", { name: "Delete" }).click()

      // Wait for the proposal tile to disappear
      await expect(page.locator("weave-tile").filter({ hasText: proposalName })).not.toBeVisible({ timeout: 10000 })

      console.log(`Successfully deleted proposal on attempt ${attempt}`)

      // Take screenshot when proposal is finally deleted
      await page.screenshot({
        path: `./test-results/proposal-deleted-attempt-${attempt}.png`,
        fullPage: true,
      })
      console.log(`Screenshot taken: proposal-deleted-attempt-${attempt}.png`)

      return true // Success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`Deletion attempt ${attempt} failed:`, errorMessage)

      if (attempt < maxRetries) {
        console.log(`Waiting ${retryDelay / 1000} seconds before retry...`)
        await page.waitForTimeout(retryDelay)
      }
    }
  }

  return false // All attempts failed
}

// Delete the test proposal
export async function deleteTestProposal(page: Page) {
  const proposalName = process.env.PROPOSAL_DUPE_NAME

  // First, navigate to the "DO NOT EDIT" proposal for safety
  console.log("Navigating to DO NOT EDIT proposal first...")
  await page.locator("weave-tile").filter({ hasText: "DO NOT EDIT" }).first().hover()
  await page.locator("weave-tile").filter({ hasText: "DO NOT EDIT" }).first().locator("div").first().click()

  // Wait for navigation to complete by checking for 3D sketch button
  await page.waitForSelector("forma-toolbar-button#conceptual", {
    state: "attached",
    timeout: 30000,
  })
  console.log("Navigation completed (3D sketch button loaded), now attempting deletion...")

  // Delete the duplicate proposal with retry mechanism
  const deleted = await deleteProposalWithRetry(page, proposalName!)
  expect(deleted, `Failed to delete proposal "${proposalName}" after 5 attempts`).toBe(true)
}

// Go to the test proposal
export async function gotoTestProposal(page: Page, testInfo: TestInfo) {
  // Initialize the page
  await init(page)

  // Return if no duplicate proposal
  if (!process.env.PROPOSAL_DUPE_ID) return console.error("No duplicate proposal to go to")

  // Go to the duplicated proposal
  const projectId = "pro_lze2pawcjj"

  await page.goto(`${getEnv("APP_BASE_URL")}/designmode/${projectId}/${process.env.PROPOSAL_DUPE_ID}`, {
    timeout: 60000,
  })

  // Wait for the 3d sketch button to show
  await page.waitForSelector("forma-toolbar-button#conceptual", {
    state: "attached",
    timeout: 60000,
  })

  // Screenshot Forma loaded
  const proposalName = process.env.PROPOSAL_DUPE_NAME
  await testInfo.attach("3d-sketch-local-forma-loaded.png", {
    body: await page.screenshot({
      path: `./test-results/3d-sketch/local-dupe-${proposalName}-forma-loaded.png`,
    }),
    contentType: "image/png",
  })
}

// Go to the main proposal
export async function gotoMainProposal(page: Page) {
  // Initialize the page
  await init(page)

  // Go to the main proposal
  await page.goto(`${getEnv("APP_BASE_URL")}/designmode/${mainProjectId}/${mainProposalId}`, { timeout: 60000 })

  // Wait for the 3d sketch button to show
  await page.waitForSelector("forma-toolbar-button#conceptual", {
    state: "attached",
    timeout: 60000,
  })
}

export async function checkBuildingSize(page: Page, size: string) {
  // Check building size from outside 3d sketch
  await expect(page.locator("#area")).toContainText(size)
}
