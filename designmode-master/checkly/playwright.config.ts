import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

dotenv.config({ path: ".env.checkly" })

// Override these as env vars locally to use other values.
// The default here will use the Checkly project in EU prod.
setDefaultEnv("APP_AUTH_BASE_URL", "https://app.autodeskforma.eu")
setDefaultEnv("APP_BASE_URL", "https://local.autodeskforma.eu:3000")
setDefaultEnv("PROJECT_ID", "pro_eg5qj2fjpm")
setDefaultEnv("PROPOSAL_ID", "4849711e-eb40-45bc-8e9a-b2c0ded9a0e9")

// See https://playwright.dev/docs/test-configuration.
export default defineConfig({
  testDir: "./src",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "REGION=eu pnpm preview",
    cwd: "..",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

function setDefaultEnv(key: string, defaultValue: string): void {
  if (process.env[key] == null) {
    process.env[key] = defaultValue
  }
}
