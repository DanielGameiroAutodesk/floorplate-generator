import { chromium } from "@playwright/test"
import { deleteTestProposal, gotoMainProposal } from "./lib"

// Global teardown function to delete the duplicate proposal used for testing
async function globalTeardown() {
  if (process.env.SKIP_GLOBAL_SCRIPTS) {
    console.log("SKIPPING GLOBAL TEARDOWN")
    return
  }

  console.log("GLOBAL TEARDOWN")

  const browser = await chromium.launch()

  // Setup the page
  const page = await browser.newPage()

  // Go to the main proposal
  await gotoMainProposal(page)

  // Delete the test/duplicate proposal
  await deleteTestProposal(page)

  await page.close()
}

export default globalTeardown
