import type { FormaElement, RoadTrafficData, RailTrafficData } from "forma-elements"

export function roadWithValidTrafficData(element: FormaElement) {
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

export function railWithValidTrafficData(element: FormaElement) {
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

export function isElementWithNoiseData(element: FormaElement) {
  return roadWithValidTrafficData(element) || railWithValidTrafficData(element)
}

// Helper function to check if an element has valid noise data
export function hasValidNoiseData(element: FormaElement): boolean {
  return !!isElementWithNoiseData(element)
}

// Helper function to check element and its immediate children for noise data
export function checkElementHierarchy(element: FormaElement): boolean {
  if (
    (element.properties?.category === "road" || element.properties?.category === "rails") &&
    hasValidNoiseData(element)
  ) {
    return true
  }

  return false
}
