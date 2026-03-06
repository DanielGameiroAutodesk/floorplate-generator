import { chromium } from "@playwright/test"
import { createTestProposal, init } from "./lib"

// Global setup function to duplicate a proposal for testing
async function globalSetup() {
  if (process.env.SKIP_GLOBAL_SCRIPTS) {
    console.log("SKIPPING GLOBAL SETUP")
    return
  }

  console.log("GLOBAL SETUP")
  const browser = await chromium.launch()

  // Setup the page
  const page = await init(await browser.newPage())

  // Create a test/duplicate proposal
  await createTestProposal(page)
}

export default globalSetup
