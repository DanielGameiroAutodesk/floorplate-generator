import {
  argMax,
  getDotProduct,
  mod,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { getSignOfPolygonAngles } from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/simplification.js"
import { preparePolygonForCityBlock } from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/exploreLayoutTypes"
import { addVectorToPoint, getAnglesInPolygon, getExtensionDistance } from "./templateHelpers.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { pointPointDistance } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { lineOfPointsToVerticesEdges } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/helpers.js"

export function getOneAngledBuilding(polygon, buildingWidth, stories) {
  //TODO: needs custom simplification?
  const _polygon = preparePolygonForCityBlock(polygon, buildingWidth)
  const n = _polygon.length
  const angleSigns = getSignOfPolygonAngles(_polygon)
  const concaveAngleIndices = angleSigns
    .map((a, i) => {
      if (a > 0) return i
      return -1
    })
    .filter((i) => i >= 0)

  const edgeVectors = _polygon.map((p, i) => getNormalizedVectorFromPointToPoint(p, _polygon[mod(i + 1, n)]))
  const sideLengths = _polygon.map((p, i) => pointPointDistance(p, _polygon[mod(i + 1, n)]))

  const candidateBuildingsIndices = []
  for (let i = 0; i < n; i++) {
    const firstIndex = i
    const secondIndex = mod(i + 1, n)
    if (concaveAngleIndices.includes(secondIndex)) continue

    const buildingIndices = [firstIndex, secondIndex]
    let prevVec = edgeVectors[i]
    let angle = 0
    for (let j = secondIndex; j < _polygon.length + firstIndex - 1; j++) {
      const prevIndex = mod(j, n)
      if (concaveAngleIndices.includes(prevIndex)) break

      const nextIndex = mod(j + 1, n)
      const nextVec = edgeVectors[prevIndex]
      angle += Math.acos(getDotProduct(prevVec, nextVec))
      if (angle > 0.8 * Math.PI) break

      buildingIndices.push(nextIndex)
      prevVec = nextVec
    }

    if (buildingIndices.length > 2) candidateBuildingsIndices.push(buildingIndices)
  }

  if (!candidateBuildingsIndices.length) return { vertices: {}, edges: {} }

  const candidateBuildingLengths = candidateBuildingsIndices.map((buildingIndices) =>
    buildingIndices.reduce((sum, i) => sum + sideLengths[i], 0),
  )
  const bestBuildingIndices = candidateBuildingsIndices[argMax(candidateBuildingLengths)]
  const bestBuilding = bestBuildingIndices.map((i) => _polygon[i])

  const angles = getAnglesInPolygon(_polygon)
  const angle1 = angles[mod(bestBuildingIndices[0], n)]
  const vec1 = edgeVectors[bestBuildingIndices[0]]
  const extensionDistance1 = getExtensionDistance(buildingWidth, angle1, buildingWidth)
  const extendedStartPoint = addVectorToPoint(bestBuilding[0], vec1, -extensionDistance1)

  const angle2 = angles[bestBuildingIndices[bestBuildingIndices.length - 1]]
  const vec2 = edgeVectors[bestBuildingIndices[bestBuildingIndices.length - 2]]
  const extensionDistance2 = getExtensionDistance(buildingWidth, angle2, buildingWidth)
  const extendedEndPoint = addVectorToPoint(bestBuilding[bestBuilding.length - 1], vec2, extensionDistance2)

  const resBuilding = [extendedStartPoint, ...bestBuilding.slice(1, bestBuilding.length - 1), extendedEndPoint]

  return lineOfPointsToVerticesEdges(resBuilding, { width: buildingWidth, stories })
}
