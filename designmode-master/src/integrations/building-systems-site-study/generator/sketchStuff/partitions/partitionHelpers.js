import { argMax, mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import {
  getAnglesAtPolygonVertices,
  getCCWPolygon,
  getPolygonCircumference,
  movePointAlongVector,
  pointPointDistance,
  pointToLineDistance,
  removeLastPointInPolygonIfEqualsFirst,
  rotatePoint,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { customIntersection } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/graphIntersectionHelpers.js"
import { v4 as uuidv4 } from "uuid"
import { getCellsWithPolygons } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellHelpers.js"
import { getGraphCutToSelfAndBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection.js"

export function getClosestPointInPolygon(tValue, allTValues, allPoints) {
  let index = allTValues.indexOf(tValue)
  if (index >= 0) {
    return allPoints[index]
  }
  for (let i = 0; i < allTValues.length; i++) {
    let t1 = allTValues[i]
    let t2 = allTValues[mod(i + 1, allTValues.length)]
    if (t1 > t2) {
      t2 = t2 + 1
    }
    if (t1 < tValue && tValue < t2) {
      if (tValue - t1 <= t2 - tValue) return allPoints[i]
      else return allPoints[mod(i + 1, allTValues.length)]
    }
  }
  return [10000000, 10000000]
}

export function getUnitVecFromAngle(angle) {
  return rotatePoint([0, 1], angle)
}

export function intersectLineWithPolygon(polygon, lineStartPoint, lineEndPoint) {
  let intersectionPoints = []
  const m = polygon.length
  for (let j = 0; j < m; j++) {
    const polygonStartPoint = polygon[j]
    const polygonEndPoint = polygon[mod(j + 1, m)]
    const intersectionPoint = intersectLineWithoutEndPointsWithPolygon(
      lineStartPoint,
      lineEndPoint,
      polygonStartPoint,
      polygonEndPoint,
    )
    if (!intersectionPoint) {
      continue
    }
    intersectionPoints.push(intersectionPoint)
  }
  intersectionPoints.sort((a, b) => pointPointDistance(a, lineStartPoint) - pointPointDistance(b, lineEndPoint))
  return intersectionPoints
}

function intersectLineWithoutEndPointsWithPolygon(
  edgeStartPoint,
  edgeEndPoint,
  buildingLimitStartPoint,
  buildingLimitEndPoint,
) {
  const intersectionResult = customIntersection(
    edgeStartPoint,
    edgeEndPoint,
    buildingLimitStartPoint,
    buildingLimitEndPoint,
  )
  if (!intersectionResult) {
    return null
  }
  const { t, u, intersectionPoint } = intersectionResult
  const tolerance = 0.00000001
  if (t > tolerance && u >= 0 && t < 1 - tolerance && u <= 1) {
    return intersectionPoint
  }
  return null
}

export function getConvexHull(polygon) {
  let convexHull = getCCWPolygon(removeLastPointInPolygonIfEqualsFirst(polygon))
  let angles = getAnglesAtPolygonVertices(convexHull)
  let concave = angles.some((a) => a > 0)
  while (concave) {
    convexHull = convexHull.filter((point, i) => angles[i] <= 0)
    angles = getAnglesAtPolygonVertices(convexHull)
    concave = angles.some((a) => a > 0)
  }
  convexHull.push(convexHull[0])
  return convexHull
}

export function skinnyPolygon2(polygon) {
  const n = polygon.length
  const sideLengths = polygon.map((_, i) => pointPointDistance(polygon[i], polygon[mod(i + 1, n)]))
  const maxIndex = argMax(sideLengths)
  const maxLine = [polygon[maxIndex], polygon[mod(maxIndex + 1, n)]]
  const distancesFromMaxLine = polygon.map((p) => pointToLineDistance(p, maxLine))
  return Math.max(...distancesFromMaxLine)
}

export function getConvexityScore(polygon, splittedPolygons) {
  const diffBefore = getPolygonCircumference(polygon) - getPolygonCircumference(getConvexHull(polygon))
  const diffAfter = splittedPolygons.reduce(
    (acc, polygon) => acc + getPolygonCircumference(polygon) - getPolygonCircumference(getConvexHull(polygon)),
    0,
  )
  return diffBefore - diffAfter
}

export function getShapeScore() {
  return true
}

export function isPolygonConcave(polygon) {
  const anglesAtVertices = getAnglesAtPolygonVertices(removeLastPointInPolygonIfEqualsFirst(polygon))
  if (anglesAtVertices.some((a) => a > 0.1)) return true
  else return false
}

export function drawEdgeThroughPointAndDirection(polygon, point, angle, maxDist) {
  const vertices = {}
  const edges = {}

  const dominantUnitVector = getUnitVecFromAngle(angle)
  const normalDominant = [-dominantUnitVector[1], dominantUnitVector[0]]

  const candidateEndPoints = []
  const p1 = movePointAlongVector(point, normalDominant, maxDist)
  const intersections1 = intersectLineWithPolygon(polygon, point, p1)
  if (intersections1.length) candidateEndPoints.push(intersections1[0])
  const p2 = movePointAlongVector(point, normalDominant, -maxDist)
  const intersections2 = intersectLineWithPolygon(polygon, point, p2)
  if (intersections2.length) candidateEndPoints.push(intersections2[0])
  if (candidateEndPoints.length < 2) return { vertices, edges }
  const startPoint = candidateEndPoints[0]
  const endPoint = candidateEndPoints[1]

  const startVertex = { id: uuidv4(), x: startPoint[0], y: startPoint[1] }
  const endVertex = { id: uuidv4(), x: endPoint[0], y: endPoint[1] }
  const edge = { id: uuidv4(), start: startVertex.id, end: endVertex.id }
  vertices[startVertex.id] = startVertex
  vertices[endVertex.id] = endVertex
  edges[edge.id] = edge
  return { vertices, edges }
}

export function drawEdgeFromPointAndDirection(polygon, startPoint, angle, maxDist) {
  const vertices = {}
  const edges = {}

  const dominantUnitVector = getUnitVecFromAngle(angle)
  const normalDominant = [-dominantUnitVector[1], dominantUnitVector[0]]

  const candidateEndPoints = []
  const p1 = movePointAlongVector(startPoint, normalDominant, maxDist)
  const intersections1 = intersectLineWithPolygon(polygon, startPoint, p1)
  if (intersections1.length) candidateEndPoints.push(intersections1[0])
  const p2 = movePointAlongVector(startPoint, normalDominant, -maxDist)
  const intersections2 = intersectLineWithPolygon(polygon, startPoint, p2)
  if (intersections2.length) candidateEndPoints.push(intersections2[0])
  if (!candidateEndPoints.length) return { vertices, edges }
  candidateEndPoints.sort((a, b) => pointPointDistance(b, startPoint) - pointPointDistance(a, startPoint))
  const endPoint = candidateEndPoints[0]

  const startVertex = { id: uuidv4(), x: startPoint[0], y: startPoint[1] }
  const endVertex = { id: uuidv4(), x: endPoint[0], y: endPoint[1] }
  const edge = { id: uuidv4(), start: startVertex.id, end: endVertex.id }
  vertices[startVertex.id] = startVertex
  vertices[endVertex.id] = endVertex
  edges[edge.id] = edge
  return { vertices, edges }
}

export function polygonsFromSplit(buildingLimits, cellGraph) {
  const graph = getGraphCutToSelfAndBuildingLimits(cellGraph, buildingLimits)
  return getCellsWithPolygons(graph, buildingLimits).map((c) => c.polygon)
}
