import type { ReadonlySignal, Signal } from "@preact/signals"
import { batch, signal } from "@preact/signals"

import { getUserinfo } from "./userInfo"

type FeatureFlagGetter<T> = (
  name: string,
  ldFlags: Record<string, string | boolean | undefined>,
  searchParams: URLSearchParams,
) => T

const getBoolean: FeatureFlagGetter<boolean> = (
  name: string,
  ldFlags: Record<string, string | boolean | undefined>,
  searchParams: URLSearchParams,
) => {
  return (
    ldFlags[name] === true || searchParams.get(name) !== null || localStorage.getItem(name)?.toLowerCase() === "true"
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function enumGetter<const T extends string>(validValues: readonly T[], defaultValue: T): FeatureFlagGetter<T> {
  return function getEnumValue(
    name: string,
    ldFlags: Record<string, string | boolean | undefined>,
    searchParams: URLSearchParams,
  ): T {
    const value = searchParams.get(name) ?? localStorage.getItem(name) ?? ldFlags[name]
    if (validValues.includes(value as T)) {
      return value as T
    } else {
      return defaultValue
    }
  }
}

const FEATURE_FLAG_GETTERS = {
  booleanFlag: getBoolean,
  scenarios: getBoolean, // squad-site-design: Scenarios feature flag
} as const

const featureFlags = (() => {
  const ldFlags = JSON.parse(sessionStorage.getItem("forma-ld-flags") ?? "{}") as Record<
    string,
    string | boolean | undefined
  >
  const searchParams = new URL(window.location.href).searchParams
  return Object.fromEntries(
    Object.entries(FEATURE_FLAG_GETTERS).map(([name, getter]) => [name, signal(getter(name, ldFlags, searchParams))]),
  ) as {
    [K in keyof typeof FEATURE_FLAG_GETTERS]: Signal<ReturnType<(typeof FEATURE_FLAG_GETTERS)[K]>>
  }
})()

export const isFeatureFlagsLoadedSignal = signal(sessionStorage.getItem("forma-ld-flags") !== null)

function update() {
  const ldFlags = JSON.parse(sessionStorage.getItem("forma-ld-flags") ?? "{}") as Record<
    string,
    string | boolean | undefined
  >
  const searchParams = new URL(window.location.href).searchParams

  batch(() => {
    isFeatureFlagsLoadedSignal.value = sessionStorage.getItem("forma-ld-flags") !== null

    Object.entries(featureFlags).forEach(([flagName, signal]) => {
      const getter = FEATURE_FLAG_GETTERS[flagName as keyof typeof FEATURE_FLAG_GETTERS]
      signal.value = getter(flagName, ldFlags, searchParams)
    })
  })
}

window.addEventListener("storage", update)
window.addEventListener("forma-ld-flags-changed", update)

// Security check: Remove URL flags for non-Autodesk employees
function removeFlagsIfUserIsNotEmployee() {
  void getUserinfo().then((res) => {
    if (!res?.email?.endsWith("@autodesk.com") && window.location.search !== "") {
      const searchParams = new URLSearchParams(window.location.search)
      const urlFlagNames = Object.keys(FEATURE_FLAG_GETTERS)

      if (urlFlagNames.some((flag) => searchParams.has(flag))) {
        window.location.href = window.location.origin + window.location.pathname
      }
    }
  })
}

removeFlagsIfUserIsNotEmployee()

export default featureFlags as {
  [K in keyof typeof FEATURE_FLAG_GETTERS]: ReadonlySignal<ReturnType<(typeof FEATURE_FLAG_GETTERS)[K]>>
}

export function useFeatureFlag<K extends keyof typeof FEATURE_FLAG_GETTERS>(
  flagName: K,
): ReturnType<(typeof FEATURE_FLAG_GETTERS)[K]> {
  return featureFlags[flagName].value
}
