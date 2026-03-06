import type { FormaElement, Urn, RoadTrafficData, RailTrafficData } from "@spacemakerai/element-types"

function roadWithValidTrafficData(element: FormaElement) {
  const trafficData = element.properties?.trafficData as RoadTrafficData
  return (
    element.properties?.category === "road" &&
    trafficData?.adt &&
    trafficData.adtDistribution &&
    trafficData.adtDistribution.dayPercentage !== undefined &&
    trafficData.adtDistribution.eveningPercentage !== undefined &&
    trafficData.adtDistribution.nightPercentage !== undefined &&
    trafficData.speed
  )
}

function railWithValidTrafficData(element: FormaElement) {
  const trafficData = element.properties?.trafficData as RailTrafficData
  return (
    trafficData &&
    element.properties?.category === "rails" &&
    trafficData.adt &&
    trafficData.adtDistribution &&
    trafficData.adtDistribution.dayPercentage !== undefined &&
    trafficData.adtDistribution.eveningPercentage !== undefined &&
    trafficData.adtDistribution.nightPercentage !== undefined &&
    trafficData.speed &&
    trafficData.railType
  )
}

function isElementWithNoiseData(element: FormaElement) {
  return roadWithValidTrafficData(element) || railWithValidTrafficData(element)
}

const hasNoiseElementCache = {} as Record<Urn, boolean | undefined>

export async function hasElementWithNoiseData(
  urn: Urn,
  getElement: ((urn: Urn) => FormaElement | undefined | Promise<FormaElement | undefined>) | undefined,
  abortSignal?: AbortSignal,
): Promise<boolean | undefined> {
  // Check if operation was aborted before proceeding
  if (abortSignal?.aborted) {
    return undefined
  }

  if (hasNoiseElementCache[urn] !== undefined) return hasNoiseElementCache[urn]
  if (!getElement) return

  // Check abort signal again before async operation
  if (abortSignal?.aborted) {
    return undefined
  }

  const element = await getElement(urn)

  // Check if aborted after async operation
  if (abortSignal?.aborted) {
    return undefined
  }

  if (!element) return
  if (isElementWithNoiseData(element)) {
    hasNoiseElementCache[urn] = true
    return true
  }
  if (!element.children) return false
  for (const child of element.children) {
    // Check abort signal before each recursive call
    if (abortSignal?.aborted) {
      return undefined
    }

    const childHasElementWithNoiseData = await hasElementWithNoiseData(child.urn, getElement, abortSignal)

    // Check abort signal after each recursive call
    if (abortSignal?.aborted) {
      return undefined
    }

    if (childHasElementWithNoiseData) {
      hasNoiseElementCache[urn] = true
      return true
    }
  }
  hasNoiseElementCache[urn] = false
  return false
}
