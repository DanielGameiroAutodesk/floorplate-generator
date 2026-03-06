import { defineConfig, devices } from "@playwright/test"
import "dotenv/config"

// This file is used to run 3d sketch tests locally

// Use random port between 4000-4999 if RANDPORT env var is true
const port = process.env.RANDPORT ? (crypto.getRandomValues(new Uint32Array(1))[0] % 1000) + 4000 : 3000

// Override these as env vars locally to use other values.
// The default here will use the Checkly project in EU prod.
setDefaultEnv("APP_AUTH_BASE_URL", "https://app.autodeskforma.eu")
setDefaultEnv("APP_BASE_URL", "https://local.autodeskforma.eu:" + port)
setDefaultEnv("PROJECT_ID", "pro_eg5qj2fjpm")
setDefaultEnv("PROPOSAL_ID", "4849711e-eb40-45bc-8e9a-b2c0ded9a0e9")

// See https://playwright.dev/docs/test-configuration.
export default defineConfig({
  testDir: "./local",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "line",
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
    command: "pnpm preview --port " + port,
    cwd: "..",
    port: port,
    env: {
      REGION: "eu",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  globalSetup: "./local/setup.ts",
  globalTeardown: "./local/teardown.ts",
  maxFailures: 1,
  snapshotDir: "./local/_snapshots",
  expect: {
    timeout: 60_000,
  },
})

function setDefaultEnv(key: string, defaultValue: string): void {
  if (process.env[key] == null) {
    process.env[key] = defaultValue
  }
}
