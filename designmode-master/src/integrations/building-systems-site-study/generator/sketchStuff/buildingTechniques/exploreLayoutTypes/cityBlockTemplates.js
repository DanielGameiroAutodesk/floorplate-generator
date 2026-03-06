import { preparePolygonForCityBlock } from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/exploreLayoutTypes"
import { getSignOfPolygonAngles } from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/simplification.js"
import {
  addBuildingToGraph,
  addVectorToPoint,
  fixTwoAngledBuildings,
  getAnglesInPolygon,
  getEdgeBuffer,
  getEdgeLengthsInPolygon,
  getExtensionDistance,
  indexBetween,
  splitBuilding,
} from "./templateHelpers.js"
import { getOneAngledBuilding } from "./oneAngledBuilding.js"
import {
  argMax,
  argMin,
  getDotProduct,
  mod,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { pointPointDistance } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { lineOfPointsToVerticesEdges } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/helpers.js"

const MIN_BUFFER_FACTOR = 1.5
const MIN_BUILDING_LENGTH_FACTOR = 1.5

//
// Closed city block
//

export function getClosedCityBlock(polygon, buildingWidth, stories) {
  const resPolygon = preparePolygonForCityBlock(polygon, buildingWidth)
  if (resPolygon.length) resPolygon.push(resPolygon[0])
  return lineOfPointsToVerticesEdges(resPolygon, { stories, width: buildingWidth })
}

//
// City blocks with gaps
//

export function getCityBlockWithGaps(raw_polygon, buildingWidth, gapSize, stories) {
  let vertices = {}
  let edges = {}
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return { vertices, edges }
  const sideLengths = getEdgeLengthsInPolygon(polygon)
  const longestSideIndex = argMax(sideLengths)
  const n = polygon.length
  let building = []
  for (let i = longestSideIndex; i < n + longestSideIndex + 1; i++) {
    const p0 = polygon[mod(i, n)]
    const p1 = polygon[mod(i + 1, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const l = pointPointDistance(p0, p1)
    if (l > buildingWidth * 3 + gapSize && i > longestSideIndex) {
      building.push(addVectorToPoint(p0, u, l / 3))
      const graph = lineOfPointsToVerticesEdges(building, { stories, width: buildingWidth })
      vertices = { ...vertices, ...graph.vertices }
      edges = { ...edges, ...graph.edges }
      building = []
    }
    if (l > buildingWidth * 3 + gapSize && i < n + longestSideIndex) {
      building.push(addVectorToPoint(p1, u, -l / 3))
    }
    if (i < n + longestSideIndex) {
      building.push(p1)
    }
  }
  const graph = lineOfPointsToVerticesEdges(building, { stories, width: buildingWidth })
  vertices = { ...vertices, ...graph.vertices }
  edges = { ...edges, ...graph.edges }
  return { vertices, edges }
}

//
// Smiley block
//

export function getSmileyBlock(raw_polygon, buildingWidth, gapSize, stories) {
  const minBuildingLength = 1.3 * buildingWidth
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const n = polygon.length
  const sideLengths = getEdgeLengthsInPolygon(polygon)
  const angles = getAnglesInPolygon(polygon)
  const edgeBuffers = angles.map((angle) => getEdgeBuffer(gapSize, angle, buildingWidth))

  const validAngles = angles.map((angle) => Math.abs(angle - 0.5 * Math.PI) < 0.3 * Math.PI)
  const validLeftAndRightAngle = validAngles.map((v, i) => v && validAngles[mod(i + 1, n)])
  const validLeftEdge = sideLengths.map((l, i) => l - edgeBuffers[mod(i + 1, n)] > minBuildingLength)
  const validRightEdge = sideLengths.map((l, i) => l - edgeBuffers[mod(i, n)] > minBuildingLength)
  const validRightAndLeftEdges = sideLengths.map(
    (_, i) => validLeftEdge[mod(i - 1, n)] && validRightEdge[mod(i + 1, n)],
  )
  const validEdgeLengths = sideLengths.map((l) => l > minBuildingLength)

  const validCapEdges = validEdgeLengths.map(
    (validEdgeLength, i) => validEdgeLength && validRightAndLeftEdges[i] && validLeftAndRightAngle[i],
  )
  const validCapEdgeIndexes = validCapEdges.map((valid, i) => (valid ? i : null)).filter((i) => i !== null)
  const validCapEdgesTwo = sideLengths.map((l, i) => l > minBuildingLength && validLeftAndRightAngle[i])
  const validCapEdgeIndexesTwo = validCapEdgesTwo.map((valid, i) => (valid ? i : null)).filter((i) => i !== null)

  const shortestNeighbour = sideLengths.map((_, i, lengths) =>
    Math.min(lengths[mod(i - 1, n)], lengths[mod(i, n)], lengths[mod(i + 1, n)]),
  )
  const lengthScores = sideLengths.map((l) => Math.min(l - 4 * buildingWidth, 0))
  const angleScores = angles.map(
    (angle, i) => -Math.max(Math.abs(0.5 * Math.PI - angle), Math.abs(Math.PI / 2 - angles[mod(i + 1, n)])),
  )
  let capEdgeIndex
  if (validCapEdgeIndexes.length) {
    capEdgeIndex = validCapEdgeIndexes[argMax(validCapEdgeIndexes.map((i) => lengthScores[i] + angleScores[i]))]
  } else if (validCapEdgeIndexesTwo.length) {
    capEdgeIndex = validCapEdgeIndexesTwo[argMax(validCapEdgeIndexesTwo.map((i) => lengthScores[i] + angleScores[i]))]
  } else {
    capEdgeIndex = argMax(shortestNeighbour)
  }

  let building = [polygon[capEdgeIndex], polygon[mod(capEdgeIndex + 1, n)]]
  graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })

  building = []
  let edgeBuffer = getEdgeBuffer(gapSize, angles[mod(capEdgeIndex + 1, n)], buildingWidth)
  if (sideLengths[mod(capEdgeIndex + 1, n)] > edgeBuffer + minBuildingLength) {
    const p0 = polygon[mod(capEdgeIndex + 1, n)]
    const p1 = polygon[mod(capEdgeIndex + 2, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    building.push(addVectorToPoint(p0, u, edgeBuffer))
  }
  for (let i = capEdgeIndex + 2; i < capEdgeIndex + n; i++) {
    building.push(polygon[mod(i, n)])
  }
  edgeBuffer = getEdgeBuffer(gapSize, angles[mod(capEdgeIndex + n, n)], buildingWidth)
  if (sideLengths[mod(capEdgeIndex + n - 1, n)] > edgeBuffer + 1.5 * buildingWidth) {
    const p0 = polygon[mod(capEdgeIndex + n - 1, n)]
    const p1 = polygon[mod(capEdgeIndex + n, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    building.push(addVectorToPoint(p1, u, -edgeBuffer))
  }
  graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
  return graph
}

//
// U Style cityBlock
//

export function getU_StyledCityBlock(raw_polygon, buildingWidth, gapSize, stories) {
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const n = polygon.length
  const edgeLengths = getEdgeLengthsInPolygon(polygon)
  const angles = getAnglesInPolygon(polygon)
  const extensionDistances = angles.map((angle) => getExtensionDistance(buildingWidth, angle, buildingWidth))

  const cutOutEdge = argMax(edgeLengths)
  const building = []
  {
    const p0 = polygon[mod(cutOutEdge + 1, n)]
    const p1 = polygon[mod(cutOutEdge + 2, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const bp = addVectorToPoint(p0, u, -extensionDistances[mod(cutOutEdge + 1, n)])
    building.push(bp)
  }
  for (let i = cutOutEdge + 2; i < cutOutEdge + n; i++) {
    building.push(polygon[mod(i, n)])
  }
  {
    const p0 = polygon[mod(cutOutEdge - 1, n)]
    const p1 = polygon[mod(cutOutEdge, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const bp = addVectorToPoint(p1, u, extensionDistances[mod(cutOutEdge, n)])
    building.push(bp)
  }

  graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
  return graph
}

//
// L Style cityBlock
//

export function getL_StyleCityBlock(raw_polygon, buildingWidth, gapSize, stories) {
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const sideLengths = getEdgeLengthsInPolygon(polygon)
  const longestSideIndex = argMax(sideLengths)

  const n = polygon.length
  const startIndex = longestSideIndex + 1
  let i = startIndex
  let leftBuffer = 0
  while (true) {
    const building = []
    let pushed = false
    if (leftBuffer + buildingWidth > sideLengths[mod(i, n)]) {
      leftBuffer = 0
      i += 1
      pushed = true
    }
    const p0 = polygon[mod(i, n)]
    const p1 = polygon[mod(i + 1, n)]
    const p2 = polygon[mod(i + 2, n)]
    const u0 = getNormalizedVectorFromPointToPoint(p0, p1)
    const u1 = getNormalizedVectorFromPointToPoint(p1, p2)
    const l1 = pointPointDistance(p1, p2)
    if (i + 2 > n + startIndex) {
      const l0 = sideLengths[mod(i, n)]
      if (i + 1 === n + startIndex && l0 > gapSize + 2 * buildingWidth && pushed) {
        building.push(p0)
        building.push(addVectorToPoint(p0, u0, l0 - gapSize - 0.5 * buildingWidth))
        graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
      }
      break
    }
    building.push(addVectorToPoint(p0, u0, leftBuffer))
    building.push(p1)
    if (i + 3 === n + startIndex) {
      building.push(p2)
    } else if (l1 >= 2 * buildingWidth + gapSize) {
      building.push(addVectorToPoint(p1, u1, l1 - gapSize - 0.5 * buildingWidth))
    } else if (l1 < 2 * buildingWidth + gapSize) {
      building.push(p2)
      leftBuffer = gapSize + 0.5 * buildingWidth
    }
    graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
    i += 2
  }
  return graph
}

//
// Open cityBlock
//

export function getOpenCityBlock(raw_polygon, buildingWidth, gapSize, stories, reverseDirection) {
  const minBuildingLength = 1.3 * buildingWidth
  const winding = reverseDirection ? 1 : -1
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const n = polygon.length
  const sideLengths = getEdgeLengthsInPolygon(polygon)
  const startIndex = argMax(sideLengths) + winding
  const angles = getAnglesInPolygon(polygon)
  const extensionDistances = angles.map((angle) => getExtensionDistance(buildingWidth, angle, buildingWidth))
  let prev = true
  for (let i = startIndex; i !== startIndex + winding * n; i += winding) {
    const p0 = polygon[mod(i, n)]
    const p1 = polygon[mod(i + 1, n)]
    const extensionDistGapSide = winding === -1 ? extensionDistances[mod(i + 1, n)] : extensionDistances[mod(i, n)]
    const extensionDistNoneGapSide = winding === -1 ? extensionDistances[mod(i, n)] : extensionDistances[mod(i + 1, n)]
    const angleGapSide = winding === -1 ? angles[mod(i + 1, n)] : angles[mod(i, n)]
    const edgeBuffer = prev ? getEdgeBuffer(gapSize, angleGapSide, buildingWidth, extensionDistGapSide) : 0
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const l = pointPointDistance(p0, p1)
    if (l + extensionDistNoneGapSide < minBuildingLength + edgeBuffer) {
      prev = false
      continue
    }
    const b0 = winding === -1 ? addVectorToPoint(p0, u, -extensionDistNoneGapSide) : addVectorToPoint(p0, u, edgeBuffer)
    const b1 = winding === -1 ? addVectorToPoint(p1, u, -edgeBuffer) : addVectorToPoint(p1, u, extensionDistNoneGapSide)
    const building = [b0, b1]
    graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
    prev = true
  }
  return graph
}

//
// Open cityBlock with point house mix
//

export function getOpenCityBlockPointHouseMix(
  raw_polygon,
  buildingWidth,
  pointBuildingWidth,
  gapSize,
  stories,
  reverseDirection,
) {
  const minBuildingLength = MIN_BUILDING_LENGTH_FACTOR * buildingWidth
  const winding = reverseDirection ? 1 : -1
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const n = polygon.length
  const sideLengths = getEdgeLengthsInPolygon(polygon)
  const startIndex = argMax(sideLengths) + winding
  const angles = getAnglesInPolygon(polygon)
  const extensionDistances = angles.map((angle) => getExtensionDistance(buildingWidth, angle, pointBuildingWidth))
  let prev = true
  let prevPointBuilding = true
  for (let i = startIndex; i !== startIndex + winding * n; i += winding) {
    const p0 = polygon[mod(i, n)]
    const p1 = polygon[mod(i + 1, n)]
    const angleGapSide = winding === -1 ? angles[mod(i + 1, n)] : angles[mod(i, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const l = pointPointDistance(p0, p1)

    const extensionDistGapSide = winding === -1 ? extensionDistances[mod(i + 1, n)] : extensionDistances[mod(i, n)]
    const extensionDistNoneGapSide = winding === -1 ? extensionDistances[mod(i, n)] : extensionDistances[mod(i + 1, n)]
    const edgeBuffer = prev
      ? getEdgeBuffer(gapSize, angleGapSide, pointBuildingWidth, extensionDistGapSide)
      : pointBuildingWidth / 2

    if (l + extensionDistNoneGapSide < Math.min(minBuildingLength, pointBuildingWidth) + edgeBuffer) {
      prev = false
      continue
    }

    const b0 = winding === -1 ? addVectorToPoint(p0, u, -extensionDistNoneGapSide) : addVectorToPoint(p0, u, edgeBuffer)
    const b1 = winding === -1 ? addVectorToPoint(p1, u, -edgeBuffer) : addVectorToPoint(p1, u, extensionDistNoneGapSide)
    prev = true

    if (prevPointBuilding) {
      prevPointBuilding = false
      const building = [b0, b1]
      graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
    } else {
      prevPointBuilding = true
      const normal = [-u[1], u[0]]
      const building = [b0, b1].map((p) => addVectorToPoint(p, normal, (pointBuildingWidth - buildingWidth) / 2))
      const buildings =
        winding === -1
          ? splitBuilding(building, pointBuildingWidth, 0.75 * pointBuildingWidth)
          : splitBuilding([building[1], building[0]], pointBuildingWidth, 0.75 * pointBuildingWidth)
      buildings.forEach(
        (building) => (graph = addBuildingToGraph(graph, building, { stories, width: pointBuildingWidth })),
      )
    }
  }
  return graph
}

//
// TowersAndAngles WIP
//

export function getTowersAndAngles(raw_polygon, buildingWidth, gapSize, pointBuildingWidth, stories) {
  const minBuildingLength = 1.3 * buildingWidth
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const n = polygon.length
  const edgeLengths = getEdgeLengthsInPolygon(polygon)
  const angles = getAnglesInPolygon(polygon)
  const extensionDistances = angles.map((angle) => getExtensionDistance(buildingWidth, angle, pointBuildingWidth))
  const edgeBuffers = angles.map((angle, i) =>
    getEdgeBuffer(gapSize, angle, 2 * (pointBuildingWidth - 0.5 * buildingWidth), extensionDistances[i]),
  )
  for (let i = 0; i < n - 1; i += 2) {
    const p0 = polygon[mod(i - 1, n)]
    const p1 = polygon[mod(i, n)]
    const p2 = polygon[mod(i + 1, n)]
    const u0 = getNormalizedVectorFromPointToPoint(p0, p1)
    const u1 = getNormalizedVectorFromPointToPoint(p1, p2)
    const l0 = edgeLengths[mod(i - 1, n)]
    const l1 = edgeLengths[mod(i, n)]

    const buffer_0 = edgeBuffers[mod(i - 1, n)]
    const buffer_1 = pointBuildingWidth + gapSize - extensionDistances[mod(i + 1, n)]
    if (buffer_1 + minBuildingLength > l1 || buffer_0 + minBuildingLength > l0) continue
    const b0 = addVectorToPoint(p1, u0, -(l0 - buffer_0))
    const b1 = p1
    const b2 = addVectorToPoint(p1, u1, l1 - buffer_1)
    const building = [b0, b1, b2]
    graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
  }
  for (let i = 0; i < n - 1; i += 2) {
    const p0 = polygon[mod(i, n)]
    const p1 = polygon[mod(i + 1, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const n_vec = [-u[1], u[0]]
    const extensionDistance = extensionDistances[mod(i + 1, n)]
    const b1 = addVectorToPoint(
      addVectorToPoint(p1, u, extensionDistance),
      n_vec,
      0.5 * (pointBuildingWidth - buildingWidth),
    )
    const b0 = addVectorToPoint(b1, u, -pointBuildingWidth)
    const building = [b0, b1]
    graph = addBuildingToGraph(graph, building, { stories, width: pointBuildingWidth })
  }

  return graph
}

//
// One angled and tower
//

export function getOneAngledTowerBuildings(raw_polygon, buildingWidth, towerWidth, stories) {
  const gapSize = 1.5 * buildingWidth
  let graph = { vertices: {}, edges: {} }
  const polygon = preparePolygonForCityBlock(raw_polygon, buildingWidth)
  if (polygon.length === 0) return graph
  const n = polygon.length
  const angles = getAnglesInPolygon(polygon)
  const edgeLengths = getEdgeLengthsInPolygon(polygon)
  const towerExtensionDistances = angles.map((angle) => getExtensionDistance(buildingWidth, angle, towerWidth))
  const extensionDistances = angles.map((angle) => getExtensionDistance(buildingWidth, angle, buildingWidth))
  const edgeBuffers = angles.map((angle, i) => getEdgeBuffer(gapSize, angle, buildingWidth, extensionDistances[i]))
  const towerEdgeBuffers = angles.map((angle, i) =>
    getEdgeBuffer(0, angle, 2 * (towerWidth - 0.5 * buildingWidth), towerExtensionDistances[i]),
  )

  const bestAngleIndex = argMin(angles.map((angle) => Math.abs(angle - 0.5 * Math.PI)))

  {
    const p0 = polygon[mod(bestAngleIndex - 1, n)]
    const p1 = polygon[mod(bestAngleIndex, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const normal = [-u[1], u[0]]
    const t1 = addVectorToPoint(
      addVectorToPoint(p1, u, towerExtensionDistances[bestAngleIndex]),
      normal,
      0.5 * towerWidth - 0.5 * buildingWidth,
    )
    const t0 = addVectorToPoint(t1, u, -towerWidth)
    const towerBuilding = [t0, t1]
    graph = addBuildingToGraph(graph, towerBuilding, { stories, width: towerWidth })
  }

  let startIndex = bestAngleIndex + 1
  let endIndex = bestAngleIndex + n - 1
  let startSplit = false
  let endSplit = false
  if (
    edgeLengths[mod(bestAngleIndex, n)] <
    towerEdgeBuffers[mod(bestAngleIndex, n)] + edgeBuffers[mod(bestAngleIndex + 1, n)]
  ) {
    if (edgeLengths[mod(bestAngleIndex + 1, n)] > 5 * buildingWidth) {
      startSplit = true
    } else {
      startIndex += 1
    }
  }
  if (
    edgeLengths[mod(bestAngleIndex - 1, n)] + towerExtensionDistances[bestAngleIndex] <
    towerWidth + edgeBuffers[mod(bestAngleIndex - 1, n)]
  ) {
    if (edgeLengths[mod(bestAngleIndex - 2, n)] > 5 * buildingWidth) {
      endSplit = true
    } else {
      endIndex -= 1
    }
  }

  if (endIndex - startIndex < 1) return graph

  const building = []
  if (!startSplit) {
    const p0 = polygon[mod(startIndex, n)]
    const p1 = polygon[mod(startIndex + 1, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const b = addVectorToPoint(p0, u, -extensionDistances[mod(bestAngleIndex + 1, n)])
    building.push(b)
  } else {
    const p0 = polygon[mod(startIndex, n)]
    const p1 = polygon[mod(startIndex + 1, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const l = edgeLengths[mod(startIndex, n)]
    const b = addVectorToPoint(p0, u, l / 2)
    building.push(b)
  }
  for (let i = startIndex + 1; i < endIndex; i++) {
    const p0 = polygon[mod(i, n)]
    building.push(p0)
  }
  if (!endSplit) {
    const p0 = polygon[mod(endIndex - 1, n)]
    const p1 = polygon[mod(endIndex, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const b = addVectorToPoint(p1, u, extensionDistances[mod(bestAngleIndex - 1, n)])
    building.push(b)
  } else {
    const p0 = polygon[mod(endIndex - 1, n)]
    const p1 = polygon[mod(endIndex, n)]
    const u = getNormalizedVectorFromPointToPoint(p0, p1)
    const l = edgeLengths[mod(endIndex - 1, n)]
    const b = addVectorToPoint(p1, u, -l / 2)
    building.push(b)
  }
  graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })

  return graph
}

//
//Two angled buildings
//

export function getTwoAngledBuildings(polygon, buildingWidth, stories) {
  const _polygon = preparePolygonForCityBlock(polygon, buildingWidth)
  if (!_polygon.length) {
    return { vertices: {}, edges: {} }
  }
  const n = _polygon.length
  const angles = getSignOfPolygonAngles(_polygon)
  const concaveIndices = angles
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
    if (concaveIndices.includes(secondIndex)) continue

    const buildingIndices = [firstIndex, secondIndex]
    let prevVec = edgeVectors[i]
    let buildingAngle = 0
    for (let j = secondIndex; j < _polygon.length + firstIndex - 1; j++) {
      const prevIndex = mod(j, n)
      if (concaveIndices.includes(prevIndex)) break

      const nextIndex = mod(j + 1, n)
      const nextVec = edgeVectors[prevIndex]
      buildingAngle += Math.acos(getDotProduct(prevVec, nextVec))
      if (buildingAngle > 0.75 * Math.PI) break
      buildingIndices.push(nextIndex)
      prevVec = nextVec
    }

    if (buildingIndices.length > 2) candidateBuildingsIndices.push(buildingIndices)
  }

  if (!candidateBuildingsIndices.length) return { vertices: {}, edges: {} }

  const buildingPairs = []

  for (let i = 0; i < candidateBuildingsIndices.length; i++) {
    const building1 = candidateBuildingsIndices[i]
    const bp11 = building1[0]
    const bp12 = building1[building1.length - 1]
    for (let j = i + 1; j < candidateBuildingsIndices.length; j++) {
      const building2 = candidateBuildingsIndices[j]
      const bp21 = building2[0]
      const bp22 = building2[building2.length - 1]
      if (
        !(
          indexBetween(bp11, bp21, bp22) ||
          indexBetween(bp12, bp21, bp22) ||
          indexBetween(bp21, bp11, bp12) ||
          indexBetween(bp22, bp11, bp12)
        )
      ) {
        buildingPairs.push([building1, building2])
      }
    }
  }
  if (!buildingPairs.length) return getOneAngledBuilding(polygon, buildingWidth, stories)

  const pairScores = buildingPairs.map((pair) => {
    const [building1, building2] = pair
    const builtIndices = [...building1.slice(0, building1.length - 2), ...building2.slice(0, building2.length - 2)]
    const nonBuiltIndices = _polygon.map((_, i) => i).filter((i) => !builtIndices.includes(i))
    const nonBuiltLength = nonBuiltIndices.reduce((sum, i) => sum + sideLengths[i], 0)
    return -nonBuiltLength
  })

  const bestBuildingPairIndex = argMax(pairScores)
  const buildingPair = buildingPairs[bestBuildingPairIndex]

  const resBuildings = buildingPair.map((buildingIndices) => buildingIndices.map((i) => _polygon[i]))

  const fixedBuildings = fixTwoAngledBuildings(
    buildingPair,
    resBuildings,
    polygon,
    edgeVectors,
    buildingWidth,
    MIN_BUFFER_FACTOR * buildingWidth,
    MIN_BUILDING_LENGTH_FACTOR * buildingWidth,
  )

  let allVertices = {}
  let allEdges = {}
  fixedBuildings.forEach((building) => {
    const { vertices, edges } = lineOfPointsToVerticesEdges(building, { width: buildingWidth, stories })
    allEdges = { ...allEdges, ...edges }
    allVertices = { ...allVertices, ...vertices }
  })
  return { vertices: allVertices, edges: allEdges }
}
