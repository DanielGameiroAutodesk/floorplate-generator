import { mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { getAngle } from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/simplification.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { lineOfPointsToVerticesEdges } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/helpers.js"
import {
  movePointAlongVector,
  pointPointDistance,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

export function addVectorToPoint(point, vector, scalar) {
  return [point[0] + scalar * vector[0], point[1] + scalar * vector[1]]
}

export function getEdgeLengthsInPolygon(polygon) {
  return polygon.map((p, i) => pointPointDistance(p, polygon[mod(i + 1, polygon.length)]))
}

export function addBuildingToGraph(graph, building, props) {
  const buildingGraph = lineOfPointsToVerticesEdges(building, props)
  const vertices = { ...graph.vertices, ...buildingGraph.vertices }
  const edges = { ...graph.edges, ...buildingGraph.edges }
  return { ...graph, vertices, edges }
}

export function getAnglesInPolygon(polygon) {
  const n = polygon.length
  const angles = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[mod(i - 1, n)]
    const p1 = polygon[mod(i, n)]
    const p2 = polygon[mod(i + 1, n)]
    const angle = getAngle(p0, p1, p2)
    angles.push(angle)
  }
  return angles
}

export function indexBetween(i, startIndex, endIndex) {
  if (startIndex <= endIndex) return i > startIndex && i < endIndex
  else return i > startIndex || i < endIndex
}

export function fixTwoAngledBuildings(
  buildingsIndices,
  buildings,
  polygon,
  edgeVectors,
  buildingWidth,
  minBuffer,
  minBuildingLength,
) {
  const noBuildings = buildingsIndices.length

  //buffer first part of buildings
  const buildings1 = []
  let remainingLengths1 = 0

  //buffer last part of buildings
  const buildings2 = []
  let remainingLengths2 = 0

  for (let i = 0; i < noBuildings; i++) {
    const curBuildingIndices = buildingsIndices[mod(i, noBuildings)]
    const curBuilding = buildings[mod(i, noBuildings)]
    const lastSegmentVec = edgeVectors[curBuildingIndices[curBuildingIndices.length - 2]]
    const lastSegment = curBuilding.slice(curBuilding.length - 2)
    const lastSegmentLength = pointPointDistance(...lastSegment)

    const nextBuildingIndices = buildingsIndices[mod(i + 1, noBuildings)]
    const nextBuilding = buildings[mod(i + 1, noBuildings)]
    const firstSegmentVec = edgeVectors[nextBuildingIndices[0]]
    const firstSegment = nextBuilding.slice(0, 2)
    const firstSegmentLength = pointPointDistance(...firstSegment)

    if (curBuildingIndices[curBuildingIndices.length - 1] !== nextBuildingIndices[0]) {
      buildings1.push(curBuilding)
      remainingLengths1 += lastSegmentLength

      buildings2.push(nextBuilding)
      remainingLengths2 += firstSegmentLength
      continue
    }

    const angle = getAngle(lastSegment[0], lastSegment[1], firstSegment[1])
    const edgeBuffer = getEdgeBuffer(minBuffer, angle, buildingWidth)

    if (edgeBuffer < lastSegmentLength - minBuildingLength) {
      remainingLengths1 += lastSegmentLength - edgeBuffer
      const lastPoint = curBuilding[curBuilding.length - 1]
      const newLastPoint = movePointAlongVector(lastPoint, lastSegmentVec, -edgeBuffer)
      const newBuilding = [...curBuilding.slice(0, curBuilding.length - 1), newLastPoint]
      buildings1[mod(i, noBuildings)] = newBuilding
    } else {
      const newBuilding = curBuilding.slice(0, curBuilding.length - 1)
      buildings1[mod(i, noBuildings)] = newBuilding
    }

    if (edgeBuffer < firstSegmentLength - minBuildingLength) {
      remainingLengths2 += firstSegmentLength - edgeBuffer
      const firstPoint = nextBuilding[0]
      const newFirstPoint = movePointAlongVector(firstPoint, firstSegmentVec, edgeBuffer)
      const newBuilding = [newFirstPoint, ...nextBuilding.slice(1)]
      buildings2[mod(i, noBuildings)] = newBuilding
    } else {
      const newBuilding = nextBuilding.slice(1)
      buildings2[mod(i, noBuildings)] = newBuilding
    }
  }

  return remainingLengths1 > remainingLengths2 ? buildings1 : buildings2
}

export function deepCopy(object) {
  return JSON.parse(JSON.stringify(object))
}

export function getEdgeBuffer(minGap, angle, buildingWidth, shift = 0) {
  let edgeBuffer = 0
  if (angle >= Math.PI / 2) {
    edgeBuffer = (minGap + 0.5 * buildingWidth * (1 - Math.cos(angle))) / Math.sin(angle)
  } else if (angle >= 0) {
    edgeBuffer = minGap + 0.5 * buildingWidth * Math.sin(angle) + shift * Math.cos(angle)
  } else if (angle >= -Math.PI / 2) {
    edgeBuffer = minGap + 0.5 * buildingWidth * Math.sin(-angle) + shift * Math.cos(-angle)
  } else {
    edgeBuffer = (minGap + 0.5 * buildingWidth * (1 - Math.cos(-angle))) / Math.sin(-angle)
  }
  return edgeBuffer
}

export function getExtensionDistance(cityBlockWidth, angle, buildingWidth) {
  const bufferedDist = 0.5 * cityBlockWidth
  let distToEdge
  if (angle >= 0 && angle <= Math.PI / 2) {
    distToEdge = bufferedDist / Math.tan((Math.PI - angle) / 2)
  } else if (angle < 0 && angle > -Math.PI / 2) {
    distToEdge = bufferedDist / Math.tan((Math.PI + angle) / 2)
  } else if (angle > Math.PI / 2 && angle < Math.PI) {
    distToEdge = bufferedDist / Math.tan((Math.PI - angle) / 2) - buildingWidth / Math.tan(Math.PI - angle)
  } else {
    distToEdge = bufferedDist / Math.tan((Math.PI + angle) / 2) - buildingWidth / Math.tan(Math.PI + angle)
  }
  return distToEdge
}

export function splitBuilding(buildingPoints, buildingLength, buffer) {
  const resBuildings = []
  const length = pointPointDistance(buildingPoints[0], buildingPoints[1])
  const buildingVector = getNormalizedVectorFromPointToPoint(buildingPoints[0], buildingPoints[1])
  const noBuildings = Math.floor((length + buffer) / (buildingLength + buffer))
  let startPoint = buildingPoints[0]
  let endPoint = movePointAlongVector(startPoint, buildingVector, buildingLength)
  for (let i = 0; i < noBuildings; i++) {
    resBuildings.push([startPoint, endPoint])
    startPoint = movePointAlongVector(endPoint, buildingVector, buffer)
    endPoint = movePointAlongVector(startPoint, buildingVector, buildingLength)
  }
  return resBuildings
}
