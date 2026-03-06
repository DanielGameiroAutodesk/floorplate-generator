import { getUserinfo } from "./userInfo"
import { signal } from "@preact/signals"
import { computedFamily } from "./signal"

export enum LDFlag {
  ImperialUnits = "imperial-units",
  SpeedImperialUnits = "speed-imperial-units",
  BasicBatch = "BasicBatch", // TODO: This seems to always be active now? Verify, and remove the flag across DesignMode
  DetailedBuildings = "details", // squad-building-systems: New detailed buildings
  LineBuildingsMeshBackend = "line-buildings-mesh-backend", // squad-site-design: Generate volume/semantic-mesh from backend (don't put from designmode)
}

// URL flags that are only available to employees (users with an @autodesk.com account)
export enum URLFlag {
  LogBasicBatches = "basic-batch",
  WSMDebug = "wsmdebug",
  EditAllIntegrate = "editAllIntegrate",

  BatchNoCache = "batchnocache",
  Debug = "debug",

  DebugEvents = "debug-events",

  Arne = "arne", //squad-building-design: ninja-copying some geo
  Visualization = "viz", //squad-envision: Visualization tab
  Space = "space", // squad-site-design: Space connected version of Site Design
  SpaceSetup = "space-setup", // squad-site-design: Space setup feature flag // squad-design-mode: Interactive tutorial system - MIGRATED TO V2
  Scenarios = "scenarios",
  GraphbuildingRepresentations = "graphbuilding-representations", // end-to-end-analysis: Include graphbuilding representations in site design scenario model
  SelectTutorials = "select-tutorials", // growth first strike, self-select tutorials experiment
  Fun = "fun",
  Fast = "fast", // squad-site-design: Fast version scenarios link
}

/** URL flags that are available to all users.
 * Be wary of putting flags here unless you've evaluated the risk of users' projects potentially being
 * corrupted when using pre-release features. This can happen for several reasons, for instance:
 *
 * 1) due to data models being changed when features are in development, the data added to the proposal while the feature
 * was in pre-release might crash the proposal if not migrated – which one might forget to do.
 * 2) Pre-release features also more often contains bugs that might change data in an unexpected way, corrupting the
 * proposal.
 * 3) A project and a proposal can be shared between different users, and if data is added to a proposal that requires
 * the feature to work, a proposal might work in an unexpected or buggy way for the user not having the feature.
 *
 * If a feature is only UI or doesn't affect data at all, it might be safe to use external flags as a means of toggling.
 * However, consider turning on a feature for an entire project using LaunchDarkly, as it is both safer (see point 3) and
 * a better experience for the user.
 */
export enum ExternalURLFlag {
  PerformanceStats = "performance-stats", // Show performance related stats for debugging
}

export enum CodeFlag {}

export type FeatureFlag = LDFlag | URLFlag | CodeFlag | ExternalURLFlag

export const codeFlags: Record<string, boolean> = {} satisfies Record<CodeFlag, boolean>
export const urlFlags: { [key: string]: boolean } = {}
export const externalUrlFlags: { [key: string]: boolean } = {}
export const authorizedFlagsInURL: { [key: string]: boolean } = {}

const searchParams = new URLSearchParams(window.location.search)
Object.values(LDFlag).forEach((v) => (urlFlags[v] = searchParams.get(v) !== null))
Object.values(URLFlag).forEach((v) => (urlFlags[v] = searchParams.get(v) !== null))
Object.values(ExternalURLFlag).forEach((v) => (externalUrlFlags[v] = searchParams.get(v) !== null))

function removeFlagsIfUserIsNotEmployee() {
  void getUserinfo().then((res) => {
    if (!res?.email?.endsWith("@autodesk.com") && window.location.search !== "") {
      const allFlags = Object.values(URLFlag)
      const searchparams = new URLSearchParams(window.location.search)
      if (allFlags.some((flag) => searchparams.has(flag))) {
        window.location.href = window.location.origin + window.location.pathname
      }
    }
  })
}

removeFlagsIfUserIsNotEmployee()

const getLaunchDarklyFlags = (): { [key: string]: boolean } => {
  return JSON.parse(sessionStorage["forma-ld-flags"] || "{}")
}

const ldFlagsSignal = signal(getLaunchDarklyFlags())

// Track LaunchDarkly initialization - starts true if flags already exist
let ldFlagsInitialized = Object.keys(getLaunchDarklyFlags()).length > 0
export const ldFlagsReadyPromise = new Promise<void>((resolve) => {
  window.addEventListener("forma-ld-flags-initialized", () => {
    resolve()
    ldFlagsInitialized = true
  })
})

function isFlagActiveInternal(flag: FeatureFlag, ldFlags: ReturnType<typeof getLaunchDarklyFlags>): boolean {
  return Boolean(ldFlags[flag] || urlFlags[flag] || codeFlags[flag] || externalUrlFlags[flag])
}

export const isFlagActive = (flag: FeatureFlag) => isFlagActiveInternal(flag, ldFlagsSignal.peek())

// Set up listener for LaunchDarkly flag changes
const setupLDFlagsListener = () => {
  ldFlagsSignal.value = getLaunchDarklyFlags()
  const listener = () => {
    ldFlagsSignal.value = getLaunchDarklyFlags()
  }
  window.addEventListener("forma-ld-flags-initialized", listener)
  return () => window.removeEventListener("forma-ld-flags-initialized", listener)
}

// Initialize the listener immediately
setupLDFlagsListener()

export const featureFlagSignalFamily = computedFamily<FeatureFlag, boolean>((flag) =>
  isFlagActiveInternal(flag, ldFlagsSignal.value),
)

export default function useFeatureFlag(flag: FeatureFlag): boolean {
  return featureFlagSignalFamily(flag).value
}

/**
 * Async function that waits for LaunchDarkly flags to be initialized before returning the flag value.
 * Useful for e.g. tracking flag values for the initial analytics page load event on app startup.
 */
export async function getFeatureFlagAsync(flag: FeatureFlag): Promise<boolean> {
  // Wait until flags are initialized (with 3 second timeout)
  const startTime = Date.now()
  while (!ldFlagsInitialized && Date.now() - startTime < 3000) {
    await new Promise((resolve) => setTimeout(resolve, 50)) // Poll every 50ms
  }

  return isFlagActive(flag)
}
