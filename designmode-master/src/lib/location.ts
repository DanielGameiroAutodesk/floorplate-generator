import { explicitSignal, type ReadonlySignalHack } from "./signal"

export const REVISION_URL_PARAM = "revision"

export namespace CurrentLocation {
  export const getProposalId = () => window.location.pathname.split("/")[3]

  export const getRevision = () => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get(REVISION_URL_PARAM) ?? undefined
  }
}

/**
 * Create a signal that represents the current window location.
 */
export function createLocationSignal(options?: { unsubscribe?: AbortSignal }): ReadonlySignalHack<Location> {
  const [locationSignal, setLocation] = explicitSignal(window.location)

  window.addEventListener(
    "popstate",
    () => {
      setLocation(window.location)
    },
    {
      signal: options?.unsubscribe,
    },
  )

  return locationSignal
}
