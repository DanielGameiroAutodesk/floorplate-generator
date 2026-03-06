import { argMax, gradOfArray, replaceIntervalInArray, setValueAboveThresholdToOne, where } from "./numpy.js"
import { getPolygonCircumference, pointPointDistance } from "./geometry.js"

const MAX_NO_CORNERS = 10
const RESOLUTION = 1000

export function getTValuesFromPoints(polygon) {
  const polygonBorderLength = getPolygonCircumference(polygon)
  let TValues = [0]
  let currentLength = 0
  for (let i = 1; i < polygon.length; i++) {
    currentLength += pointPointDistance(polygon[i - 1], polygon[i])
    TValues.push(currentLength / polygonBorderLength)
  }
  return TValues
}

export function getBoundsForCorners(curvature, threshold) {
  const filteredLine = curvature.map((c) => setValueAboveThresholdToOne(c, threshold))
  const grad = gradOfArray(filteredLine)
  const intersections = where(grad)
  return intersections
}

export function getTValuesInCorners(normalizedCurvature, intersections, fillAmount) {
  if (intersections.length === 0) {
    return []
  }
  const curvatureTotalSum = normalizedCurvature.reduce((sum, c) => sum + c, 0)
  let cornerTValues = []
  let filled = 1.0
  let noCorners = 0
  let resCurvature = normalizedCurvature
  const n = normalizedCurvature.length
  while (filled > fillAmount && noCorners < MAX_NO_CORNERS) {
    noCorners += 1
    const cornerTValue = argMax(resCurvature)
    cornerTValues.push(cornerTValue / RESOLUTION)
    const largerTValues = intersections.filter((t) => t > cornerTValue)

    let largerTValue
    if (largerTValues.length === 0) {
      largerTValue = Math.min(...intersections)
    } else {
      largerTValue = Math.min(...largerTValues)
    }

    const smallerTValues = intersections.filter((t) => t < cornerTValue)

    let smallerTValue
    if (smallerTValues.length === 0) {
      smallerTValue = Math.max(...intersections)
    } else {
      smallerTValue = Math.max(...smallerTValues)
    }
    if (smallerTValue > largerTValue) {
      resCurvature = replaceIntervalInArray(resCurvature, 0, smallerTValue, n)
      resCurvature = replaceIntervalInArray(resCurvature, 0, 0, largerTValue)
    } else {
      resCurvature = replaceIntervalInArray(resCurvature, 0, smallerTValue, largerTValue + 1)
    }
    const currentSum = resCurvature.reduce((sum, c) => sum + c, 0)

    filled = currentSum / curvatureTotalSum
  }
  return cornerTValues.sort()
}

export function getTValuesOfSignificantCorners(curvature, threshold, fillAmount) {
  const intersections = getBoundsForCorners(curvature, threshold)
  return getTValuesInCorners(curvature, intersections, fillAmount)
}
