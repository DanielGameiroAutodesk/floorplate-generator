// eslint-disable-next-line import/no-restricted-paths
import { PROJECT_ID } from "src/core/project/project"

import { isFlagActive, LDFlag } from "./featureToggling"
import { captureException } from "@sentry/browser"
import { signal } from "@preact/signals"
import { request } from "./request"
import { getTranslator } from "src/i18n"

interface PartialProjectSettings {
  measurementUnits: MeasurementUnitSettings
}

interface ProjectSettingsCache {
  [projectId: string]: PartialProjectSettings
}

let fetched = false
let settingsCache: ProjectSettingsCache | undefined = undefined

export const fetchMeasurementSettings = async (forceUpdate: boolean) => {
  // load the settings cache from local storage
  readFromSettingsCache()

  if (!fetched || forceUpdate) {
    return await request(`/api/geo-settings?authcontext=${PROJECT_ID}`)
      .then((response) => response.json())
      .then(
        (settings: PartialProjectSettings) => {
          unitSettingsSignal.value = settings.measurementUnits
          fetched = true
          if (settingsCache === undefined) {
            settingsCache = {}
          }
          settingsCache[PROJECT_ID] = settings
          console.log("Fetched settings", settings)
          ;(globalThis as any).settingsCache = settingsCache

          // always write to settings cache on fetch
          localStorage.setItem("project-settings-cache", JSON.stringify(settingsCache))
          sessionStorage.setItem("project-id", PROJECT_ID)
          sessionStorage.setItem("unit-settings", JSON.stringify(settings.measurementUnits))
          return settings
        },
        (err) => {
          if (![401, 403].includes(err.responseCode)) {
            captureException(err, { tags: { owner: "squad-precision" } })
          }

          try {
            const t = getTranslator()
            window.forma_toasts?.push({ content: t(($) => $.building.errors.failedToLoadSettings), status: "warning" })
          } catch (e) {
            console.error("Failed to push toast", e)
          }
        },
      )
  }
  return settingsCache
}

export interface MeasurementUnitSettings {
  /**
   * The unit to use for length measurements. If not set, read from LDFlags.
   */
  lengthUnit: "m" | "ft"
}

/**
 * Reads the settings from the local file system
 */
function readFromSettingsCache() {
  if (settingsCache === undefined) {
    const settingsCacheString = localStorage.getItem("project-settings-cache")
    if (settingsCacheString) {
      settingsCache = JSON.parse(settingsCacheString)
    }

    // stash this on the globalThis so we can see it in the console
    ;(globalThis as any).settingsCache = settingsCache
  }

  return settingsCache
}

export function useIsImperial() {
  const launchDarklyImperialUnitsFlag = isFlagActive(LDFlag.ImperialUnits)

  // if the database doesn't have a value, just use the launch darkly flag
  if (unitSettingsSignal.value === undefined) {
    return launchDarklyImperialUnitsFlag
  }

  // otherwise, read the database value
  return unitSettingsSignal.value?.lengthUnit === "ft"
}

// Same as useIsImperial, but NOT reactive.
export function isProjectImperial() {
  const launchDarklyImperialUnitsFlag = isFlagActive(LDFlag.ImperialUnits)

  // if the database doesn't have a value, just use the launch darkly flag
  if (unitSettingsSignal.peek()?.lengthUnit === undefined) {
    return launchDarklyImperialUnitsFlag
  }

  // otherwise, read the database value
  return unitSettingsSignal.peek()?.lengthUnit === "ft"
}

export const unitSettingsSignal = signal<MeasurementUnitSettings | undefined>()

/** Write project settings to local-storage for inspection */
let i = 0
unitSettingsSignal.subscribe((measurementUnitsSettings) => {
  // Skip initial value.
  if (i++ === 0) return

  if (!settingsCache) {
    settingsCache = {}
  }

  settingsCache[PROJECT_ID] = {
    ...settingsCache[PROJECT_ID],
    ...measurementUnitsSettings,
  }
  localStorage.setItem("project-settings-cache", JSON.stringify(settingsCache))
  sessionStorage.setItem("project-id", PROJECT_ID)
  sessionStorage.setItem("unit-settings", JSON.stringify(measurementUnitsSettings))
})

window.addEventListener("geo-settings-updated", (evt: any) => {
  console.log("Geo settings updated", evt?.detail?.geoSettingsDb)
  if (evt?.detail?.geoSettingsDb) {
    settingsCache = settingsCache || {}
    settingsCache[PROJECT_ID] = evt?.detail?.geoSettingsDb
    unitSettingsSignal.value = evt?.detail?.geoSettingsDb.measurementUnits
  }
})
