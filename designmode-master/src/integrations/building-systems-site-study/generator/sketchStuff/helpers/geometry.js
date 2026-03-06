import polygonClipping from "polygon-clipping"
import { gaussSmoothen } from "./gauss.js"
import { argMax, clipValue, getDotProduct, mod, normalizedVectorFromPoints, pointsAreEqual } from "./numpy.js"
import { getIntersectionAreaBetweenGroupsOfDisjunctPolygons, getIntersectionAreas } from "./intersectionArea.js"
const NPD = 1e-6
const HNPD = 1e-3

//////////////////////////////////////////////////
//                                              //
//   ____________________                       //
// < Coordinate transform >                     //
//   --------------------                       //
//                 \   ^__^                     //
//                  \  (oo)\_______             //
//                     (__)\       )\/\         //
//                         ||----w |            //
//                         ||     ||            //
//                                              //
//  Author: Hallvard Nydal                      //
//  Date: 01.11.2007                            //
//                                              //
//  Version history:                            //
//  0.1: Initial commit                         //
//  0.2: Added coordinate transform             //
//  0.3: Replaced overlap function              //
//                                              //
//                                              //
//////////////////////////////////////////////////

export function getNormVector(p1, p2) {
  const vec = [p2[0] - p1[0], p2[1] - p1[1]]
  const len = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2))
  return len < 1e-8 ? vec : [vec[0] / len, vec[1] / len]
}

export function rotatePoint(point, rotation, pivot = [0, 0]) {
  const x = (point[0] - pivot[0]) * Math.cos(rotation) - (point[1] - pivot[1]) * Math.sin(rotation) + pivot[0]
  const y = (point[0] - pivot[0]) * Math.sin(rotation) + (point[1] - pivot[1]) * Math.cos(rotation) + pivot[1]
  return [x, y]
}

export function rotatePoints(points, rotation, pivot = [0, 0]) {
  return points.map((point) => rotatePoint(point, rotation, pivot))
}

export function determinant(vector1, vector2) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}

function dotProduct(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1]
}

export function getVectorFromPointToPoint(startPoint, endPoint) {
  return [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]]
}

export function addVectorToPoint(point, vector) {
  return [point[0] + vector[0], point[1] + vector[1]]
}

export function translatePolygon(polygon, vector) {
  const [deltaX, deltaY] = vector
  return polygon.map(([x, y]) => [x + deltaX, y + deltaY])
}

export function scale(vector, scalar) {
  return [scalar * vector[0], scalar * vector[1]]
}

export function pointPointDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

export function vectorLength(vector) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2))
}

export function getLineLength(line) {
  return Math.sqrt(Math.pow(line[1][0] - line[0][0], 2) + Math.pow(line[1][1] - line[0][1], 2))
}

export function normalizeVector(vector) {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length]
}

export function simpleUnitVector(startPoint, endPoint) {
  return normalizeVector(getVectorFromPointToPoint(startPoint, endPoint))
}

export function movePointAlongVector(point, vector, distance) {
  const moveVector = scale(normalizeVector(vector), distance)
  return addVectorToPoint(point, moveVector)
}

export function getMidPoint(point_1, point_2) {
  return [(point_1[0] + point_2[0]) / 2, (point_1[1] + point_2[1]) / 2]
}

export function polygonArea(poly) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    area += determinant(p1, p2)
  }
  return 0.5 * Math.abs(area)
}

export function closedPolygonCentroid(poly) {
  let doubleSignedArea = 0
  let centroid = [0, 0]
  for (let i = 0; i < poly.length - 1; i++) {
    const factor = determinant(poly[i], poly[i + 1])
    doubleSignedArea += factor
    centroid[0] += (poly[i][0] + poly[i + 1][0]) * factor
    centroid[1] += (poly[i][1] + poly[i + 1][1]) * factor
  }
  centroid = [centroid[0] / (3 * doubleSignedArea), centroid[1] / (3 * doubleSignedArea)]
  return centroid
}

function rotate(vector, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [cos * vector[0] - sin * vector[1], sin * vector[0] + cos * vector[1]]
}

export function angleBetweenVectors(vector1, vector2) {
  const cos = dotProduct(vector1, vector2) / (vectorLength(vector1) * vectorLength(vector2))
  return Math.acos(Math.max(-1, Math.min(cos, 1)))
}

export function counterClockviseAngleBetweenVectors(vector1, vector2) {
  return Math.atan2(
    vector1[0] * vector2[1] - vector1[1] * vector2[0],
    vector1[0] * vector2[0] + vector1[1] * vector2[1],
  )
}

/**
 *
 * @param {[number, number]} point
 * @param {[number, number]} lineStart
 * @param {[number, number]} lineEnd
 * @returns {[number, number]}
 */
export function nearestPointOnLine(point, lineStart, lineEnd) {
  const lineVector = simpleUnitVector(lineStart, lineEnd)
  const pointVector = getVectorFromPointToPoint(lineStart, point)
  const projectionLength = dotProduct(lineVector, pointVector)
  return movePointAlongVector(lineStart, lineVector, projectionLength)
}

export function pointToLineSegmentDistance(point, lineStart, lineEnd) {
  const startDistance = pointPointDistance(point, lineStart)
  const endDistance = pointPointDistance(point, lineEnd)
  const linePoint = nearestPointOnLine(point, lineStart, lineEnd)
  if (
    linePoint[0] - Math.min(lineStart[0], lineEnd[0]) > -NPD &&
    linePoint[1] - Math.min(lineStart[1], lineEnd[1]) > -NPD &&
    linePoint[0] - Math.max(lineStart[0], lineEnd[0]) < +NPD &&
    linePoint[1] - Math.max(lineStart[1], lineEnd[1]) < +NPD
  ) {
    const lineDistance = pointPointDistance(point, linePoint)
    return Math.min(startDistance, endDistance, lineDistance)
  }
  return Math.min(startDistance, endDistance)
}

export function lineIntersectionPoint(line1_start, line1_end, line2_start, line2_end) {
  const xdiff = [line1_start[0] - line1_end[0], line2_start[0] - line2_end[0]]
  const ydiff = [line1_start[1] - line1_end[1], line2_start[1] - line2_end[1]]

  const div = determinant(xdiff, ydiff)
  if (Math.abs(div) < NPD) {
    return null
  }

  const d = [determinant(line1_start, line1_end), determinant(line2_start, line2_end)]
  const x = determinant(d, xdiff) / div
  const y = determinant(d, ydiff) / div
  return [x, y]
}

export function lineSegmentsIntersect(s1_start, s1_end, s2_start, s2_end, countEndpoints = false) {
  const v1 = getVectorFromPointToPoint(s1_end, s1_start)
  const v2 = getVectorFromPointToPoint(s2_start, s2_end)
  const v3 = getVectorFromPointToPoint(s2_start, s1_start)
  const normalizedDeterminant = determinant(normalizeVector(v1), normalizeVector(v2))
  if (Math.abs(normalizedDeterminant) < 0.0001) {
    return false
  }
  const d = determinant(v1, v2)
  const t = determinant(v3, v2) / d
  const u = determinant(v1, v3) / d
  if (!countEndpoints) {
    const intersectionPoint = addVectorToPoint(s1_start, scale(getVectorFromPointToPoint(s1_start, s1_end), t))
    if ([s1_start, s1_end, s2_start, s2_end].some((point) => 0.01 > pointPointDistance(point, intersectionPoint)))
      return false
  }
  return t >= 0 && u >= 0 && t <= 1 && u <= 1
}

function isPointInPolygonInterior(point, polygon) {
  let closedPolygon = polygon
  if (pointPointDistance(polygon[0], polygon[polygon.length - 1]) > NPD) closedPolygon = closePolygon(polygon)

  const centralVectors = closedPolygon.map((p) => getVectorFromPointToPoint(point, p))
  const signedAngles = centralVectors.slice(0, centralVectors.length - 1).map((_, index) => {
    const firstVectorAngle = Math.atan2(centralVectors[index][1], centralVectors[index][0])
    const rotatedSecondVector = rotate(centralVectors[index + 1], -firstVectorAngle)
    return Math.atan2(rotatedSecondVector[1], rotatedSecondVector[0])
  })
  const angleSum = signedAngles.reduce((angle, sum) => sum + angle, 0)
  return Math.abs(angleSum) > Math.PI
}

export function pointOnLineSegment(point, lineStart, lineEnd) {
  if (pointPointDistance(point, lineStart) < NPD || pointPointDistance(point, lineEnd) < NPD) return true
  const lineVector = getVectorFromPointToPoint(lineStart, lineEnd)
  const startToPointVector = getVectorFromPointToPoint(lineStart, point)
  const parallel = Math.abs(determinant(normalizeVector(lineVector), normalizeVector(startToPointVector))) < 0.0001
  const withinBounds =
    point[0] - Math.min(lineStart[0], lineEnd[0]) > -NPD &&
    Math.max(lineStart[0], lineEnd[0]) - point[0] > -NPD &&
    point[1] - Math.min(lineStart[1], lineEnd[1]) > -NPD &&
    Math.max(lineStart[1], lineEnd[1]) - point[1] > -NPD
  return parallel && withinBounds
}

export function pointInPolygon(point, polygon, countBoundary) {
  let closedPolygon = polygon
  if (pointPointDistance(polygon[0], polygon[polygon.length - 1]) > NPD) closedPolygon = closePolygon(polygon)
  const onBoundary = closedPolygon
    .slice(0, closedPolygon.length - 1)
    .some((_, index) => pointOnLineSegment(point, closedPolygon[index], closedPolygon[index + 1]))
  if (onBoundary) return countBoundary

  return isPointInPolygonInterior(point, polygon)
}

export function fractionWithin(polygon, containingPolygons) {
  if (containingPolygons.length === 0) return 1
  const _polygonArea = polygonArea(polygon)
  if (_polygonArea === 0) return 0
  const intersectionArea = getIntersectionAreaBetweenGroupsOfDisjunctPolygons([polygon], containingPolygons)
  return Number(Math.min(intersectionArea / _polygonArea, 1.0).toFixed(4))
}

export function samplePointsAlongPolygonExterior(polygon, resolution) {
  const samplePoints = polygon.flatMap((p, i) => {
    const vec = getVectorFromPointToPoint(p, polygon[(i + 1) % polygon.length])
    const numPoints = Math.floor(vectorLength(vec) / resolution) + 1
    return Array(numPoints)
      .fill(0)
      .map((_, i) => movePointAlongVector(p, vec, i * resolution))
  })
  return samplePoints
}

export function booleanOverlap(poly1, poly2) {
  let closedPoly1 = poly1
  let closedPoly2 = poly2
  if (pointPointDistance(poly1[0], poly1[poly1.length - 1]) > NPD) closedPoly1 = closePolygon(poly1)
  if (pointPointDistance(poly2[0], poly2[poly2.length - 1]) > NPD) closedPoly2 = closePolygon(poly2)

  if (booleanIntersect(closedPoly1, closedPoly2)) return true
  return (
    pointInPolygon(closedPolygonCentroid(closedPoly2), closedPoly1, false) ||
    pointInPolygon(closedPolygonCentroid(closedPoly1), closedPoly2, false)
  )
}

export function booleanIntersect(poly1, poly2) {
  let closedPoly1 = poly1
  let closedPoly2 = poly2
  if (pointPointDistance(poly1[0], poly1[poly1.length - 1]) > NPD) closedPoly1 = closePolygon(poly1)
  if (pointPointDistance(poly2[0], poly2[poly2.length - 1]) > NPD) closedPoly2 = closePolygon(poly2)

  for (let i = 0; i < closedPoly1.length - 1; i++) {
    for (let j = 0; j < closedPoly2.length - 1; j++) {
      if (lineSegmentsIntersect(closedPoly1[i], closedPoly1[i + 1], closedPoly2[j], closedPoly2[j + 1])) {
        return true
      }
    }
  }
  return false
}

export function copyPolygon(polygon) {
  let copiedPolygon = []
  for (let i = 0; i < polygon.length; i++) {
    copiedPolygon.push([...polygon[i]])
  }
  return copiedPolygon
}

function polygonIsClosed(polygon) {
  return pointPointDistance(polygon[0], polygon[polygon.length - 1]) < NPD
}

export function closePolygon(polygon) {
  let closedPolygon = copyPolygon(polygon)
  closedPolygon.push(polygon[0])
  return closedPolygon
}

export function polygonInPolygon(innerPolygon, outerPolygon, countBoundary = true) {
  const closedInnerPoly = polygonIsClosed(innerPolygon) ? innerPolygon : closePolygon(innerPolygon)
  const closedOuterPoly = polygonIsClosed(outerPolygon) ? outerPolygon : closePolygon(outerPolygon)

  for (let i = 0; i < closedInnerPoly.length - 1; i++) {
    if (!pointInPolygon(closedInnerPoly[i], closedOuterPoly, countBoundary)) {
      return false
    }
  }
  for (let i = 0; i < closedInnerPoly.length - 1; i++) {
    for (let j = 0; j < closedOuterPoly.length - 1; j++) {
      if (
        lineSegmentsIntersect(closedInnerPoly[i], closedInnerPoly[i + 1], closedOuterPoly[j], closedOuterPoly[j + 1])
      ) {
        return false
      }
    }
  }
  return true
}

export function speedyPolygonInPolygon(innerPolygon, outerPolygon) {
  const closedInnerPoly = polygonIsClosed(innerPolygon) ? innerPolygon : closePolygon(innerPolygon)
  const closedOuterPoly = polygonIsClosed(outerPolygon) ? outerPolygon : closePolygon(outerPolygon)

  if (!pointInPolygon(closedInnerPoly[0], closedOuterPoly, true)) {
    return false
  }

  for (let i = 0; i < closedInnerPoly.length - 1; i++) {
    for (let j = 0; j < closedOuterPoly.length - 1; j++) {
      if (
        lineSegmentsIntersect(closedInnerPoly[i], closedInnerPoly[i + 1], closedOuterPoly[j], closedOuterPoly[j + 1])
      ) {
        return false
      }
    }
  }
  return true
}

export function polygonPartlyInPolygon(innerPolygon, outerPolygon) {
  const closedInnerPoly = polygonIsClosed(innerPolygon) ? innerPolygon : closePolygon(innerPolygon)
  const closedOuterPoly = polygonIsClosed(outerPolygon) ? outerPolygon : closePolygon(outerPolygon)

  for (let i = 0; i < closedInnerPoly.length - 1; i++) {
    if (pointInPolygon(closedInnerPoly[i], closedOuterPoly, true)) {
      return true
    }
  }
  return false
}

export function polygonSelfIntersection(polygon) {
  let closedPolygon = copyPolygon(polygon)
  if (pointPointDistance(polygon[0], polygon[polygon.length - 1]) > NPD) closedPolygon = closePolygon(polygon)

  for (let i = 0; i < closedPolygon.length - 1; i++) {
    for (let j = 0; j < closedPolygon.length - 1; j++) {
      if (
        i !== j &&
        lineSegmentsIntersect(closedPolygon[i], closedPolygon[i + 1], closedPolygon[j], closedPolygon[j + 1])
      ) {
        return true
      }
    }
  }
  return false
}

export function getBbox(polygons, buffer = 0) {
  const xs = [],
    ys = []
  polygons.forEach((poly) =>
    poly.forEach(([x, y]) => {
      xs.push(x)
      ys.push(y)
    }),
  )
  return {
    xMin: Math.min(...xs) - buffer,
    yMin: Math.min(...ys) - buffer,
    xMax: Math.max(...xs) + buffer,
    yMax: Math.max(...ys) + buffer,
  }
}

export function getBoundingPolygon(polygons, buffer = 0, angle = 0) {
  const bbox = getBbox(polygons, buffer)
  const boundingPolygon = [
    [bbox.xMin, bbox.yMin],
    [bbox.xMax, bbox.yMin],
    [bbox.xMax, bbox.yMax],
    [bbox.xMin, bbox.yMax],
  ]
  return rotatePoints(boundingPolygon, angle, getCenterOfMass(boundingPolygon))
}

export function getCenterOfMass(poly) {
  return poly.reduce((acc, p, _, all) => [acc[0] + p[0] / all.length, acc[1] + p[1] / all.length], [0, 0])
}

export function getUnitVector(startPoint, endPoint) {
  const distance = pointPointDistance(startPoint, endPoint)
  const vectorX = (endPoint[0] - startPoint[0]) / distance
  const vectorY = (endPoint[1] - startPoint[1]) / distance
  return { x: vectorX, y: vectorY }
}

export function getUnitNormalVector(p0, p1) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
  return [(y0 - y1) / length, (x1 - x0) / length]
}

function crossProduct(vector_1, vector_2) {
  return vector_1.x * vector_2.y - vector_1.y * vector_2.x
}

export function isLinkRightAngled(vector_1, vector_2) {
  return crossProduct(vector_1, vector_2) < 0
}

export function isClockwise(poly) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

export function reversePolygon(polygon) {
  let reversedPolygon = []
  for (let i = 0; i < polygon.length; i++) {
    reversedPolygon.push(polygon[polygon.length - i - 1])
  }
  return reversedPolygon
}

export function getCCWPolygon(polygon) {
  if (isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function getCWPolygon(polygon) {
  if (!isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function cleanPolygon(polygon) {
  const cleanedPolygon = getCCWPolygon(polygon).filter((p, i, l) => {
    const dist = ((p[0] - l[(i + 1) % l.length][0]) ** 2 + (p[1] - l[(i + 1) % l.length][1]) ** 2) ** 0.5
    return dist > 1e-5
  })
  if (polygonHasAcuteAngle(cleanedPolygon)) console.warn("Acute angles in polygon: ", JSON.stringify(cleanedPolygon))
  return cleanedPolygon
}

export function union(polygons) {
  if (!polygons || polygons.length === 0) {
    return []
  }
  const union = polygonClipping.union(polygons.map((p) => [p]))
  return union.map((geoJsonPolygon) => geoJsonPolygon[0])
}

export function multiPolygonDiff(multiPolygon1, multiPolygon2) {
  const diff = polygonClipping.difference(
    multiPolygon1.map((p) => [p]),
    multiPolygon2.map((p) => [p]),
  )
  if (diff.some((d) => d.length > 1)) {
    throw new Error("The difference between the polygons have holes. Not supported.")
  }
  return diff.map((geoJsonPolygon) => geoJsonPolygon.flat()).filter((poly) => polygonArea(poly) > 0.1)
}

export function shiftLineToRight(line, distance) {
  const start_point = line[0]
  const end_point = line[1]

  const vector = [end_point[0] - start_point[0], end_point[1] - start_point[1]]
  const rotated_vector = [vector[1], -vector[0]]

  const start_point_shifted = movePointAlongVector(start_point, rotated_vector, distance)
  const end_point_shifted = movePointAlongVector(end_point, rotated_vector, distance)

  return [start_point_shifted, end_point_shifted]
}

export const polygonInSquare = (p0, p1, polygon) => {
  for (const i in polygon) {
    if (p0[0] >= polygon[i][0] || p1[0] <= polygon[i][0] || p0[1] >= polygon[i][1] || p1[1] <= polygon[i][1])
      return false
  }
  return true
}

export function getBoundingBoxCoveringAllRotationAnglesForPolygon(polygon) {
  const pivotPoint = getCenterOfMass(polygon)
  const maxDistanceToPivot = Math.max(...polygon.map((point) => pointPointDistance(point, pivotPoint)))
  return {
    xMin: pivotPoint[0] - maxDistanceToPivot,
    xMax: pivotPoint[0] + maxDistanceToPivot,
    yMin: pivotPoint[1] - maxDistanceToPivot,
    yMax: pivotPoint[1] + maxDistanceToPivot,
  }
}

export function getDefaultStructureForGridOneBuildingLimit(buildingLimit) {
  const bbox = getBoundingBoxCoveringAllRotationAnglesForPolygon(buildingLimit)
  return { originPoint: [bbox.xMin, bbox.yMin], boxWidth: bbox.xMax - bbox.xMin, boxHeight: bbox.yMax - bbox.yMin }
}

export function pointToLineDistance(point, line) {
  return (2 * triangleArea(point, line[0], line[1])) / pointPointDistance(line[0], line[1])
}

function triangleArea(p1, p2, p3) {
  return 0.5 * Math.abs(p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]))
}

export function simplifyClosedPolygonWithConvexAndConcaveThresholds(polygon, convexThreshold, concaveThreshold) {
  const simplifiedPolygon = simplifyOpenPolygonWithConvexAndConcaveThresholds(
    polygon.slice(0, polygon.length - 1),
    convexThreshold,
    concaveThreshold,
  )
  simplifiedPolygon.push(simplifiedPolygon[0])
  return simplifiedPolygon
}

export function simplifyOpenPolygonWithConvexAndConcaveThresholds(polygon, convexThreshold, concaveThreshold) {
  let maxDist = 0
  let maxConcaveDist = 0
  let index1 = 0
  let index2 = 0
  const angles = getAnglesAtPolygonVertices(polygon)
  for (let i = 1; i < polygon.length - 1; i++) {
    const currentDist = pointToLineDistance(polygon[i], [polygon[0], polygon[polygon.length - 1]])
    if (currentDist > maxDist && angles[i] >= 0) {
      maxDist = currentDist
      index1 = i
    } else if (currentDist > maxConcaveDist && angles[i] <= 0) {
      maxConcaveDist = currentDist
      index2 = i
    }
  }

  let simplifiedPolygon = []
  if (maxConcaveDist > concaveThreshold) {
    const firstHalf = simplifyOpenPolygonWithConvexAndConcaveThresholds(
      polygon.slice(0, index2 + 1),
      convexThreshold,
      concaveThreshold,
    )
    const secondHalf = simplifyOpenPolygonWithConvexAndConcaveThresholds(
      polygon.slice(index2),
      convexThreshold,
      concaveThreshold,
    )
    simplifiedPolygon = [...firstHalf, ...secondHalf.slice(1)]
  } else if (maxDist > convexThreshold) {
    const firstHalf = simplifyOpenPolygonWithConvexAndConcaveThresholds(
      polygon.slice(0, index1 + 1),
      convexThreshold,
      concaveThreshold,
    )
    const secondHalf = simplifyOpenPolygonWithConvexAndConcaveThresholds(
      polygon.slice(index1),
      convexThreshold,
      concaveThreshold,
    )
    simplifiedPolygon = [...firstHalf, ...secondHalf.slice(1)]
  } else {
    simplifiedPolygon = [polygon[0], polygon[polygon.length - 1]]
  }
  return simplifiedPolygon
}

export const removeSelfClosingPoint = (coords) => {
  const firstPoint = coords[0]
  const lastPoint = coords[coords.length - 1]

  if (firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]) {
    coords.pop()
  }

  return coords
}

export function polygonOverlappingArea(polygon1, polygon2) {
  const intersectionArea = getIntersectionAreas([polygon1, polygon2])
  return intersectionArea[0]
}

export function intersectPolygons(polygon1, polygon2) {
  const poly1 = [polygon1]
  const poly2 = [polygon2]
  try {
    const intersections = polygonClipping.intersection(poly1, poly2)
    return intersections.map((intersect) => intersect[0].slice(0, -1))
  } catch (e) {
    console.log("Polygon clipping failed: ", e)
    console.log("Retrying with trimmed decimals")
    try {
      const poly1LowPrecision = [polygon1.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100])]
      const poly2LowPrecision = [polygon2.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100])]
      const intersections = polygonClipping.intersection(poly1LowPrecision, poly2LowPrecision)
      return intersections.map((intersect) => intersect[0].slice(0, -1))
    } catch (f) {
      console.log("Could not clip polygon: ", f)
      throw f
    }
  }
}

export const equalNumbersWithPrecision = (num1, num2, tolerance = HNPD) => {
  return Math.abs(num1 - num2) < tolerance
}

export function simplifyOpenPolygon(poly, epsilon) {
  let maxDist = 0
  let index = 0
  for (let i = 1; i < poly.length - 1; i++) {
    const currentDist = pointToLineDistance(poly[i], [poly[0], poly[poly.length - 1]])
    if (currentDist > maxDist) {
      maxDist = currentDist
      index = i
    }
  }

  let simplifiedPolygon = []
  if (maxDist > epsilon) {
    const firstHalf = simplifyOpenPolygon(poly.slice(0, index + 1), epsilon)
    const secondHalf = simplifyOpenPolygon(poly.slice(index), epsilon)
    simplifiedPolygon = [...firstHalf, ...secondHalf.slice(1)]
  } else {
    simplifiedPolygon = [poly[0], poly[poly.length - 1]]
  }

  return simplifiedPolygon
}

export function pullBackMidPoint(p1, p2, p3, dist) {
  const edgeVec1 = getNormVector(p1, p2)
  const edgeVec2 = getNormVector(p2, p3)
  const offsetVec1 = [-edgeVec1[1], edgeVec1[0]]
  const offsetVec2 = [-edgeVec2[1], edgeVec2[0]]

  const resVec = normalizeVector([offsetVec1[0] + offsetVec2[0], offsetVec1[1] + offsetVec2[1]])
  return [p2[0] - resVec[0] * dist, p2[1] - resVec[1] * dist]
}

function getAngleOfVector(vector, useRadians = false) {
  const scale = useRadians ? 1.0 : 180 / Math.PI
  return mod(Math.atan2(vector[1], vector[0]), Math.PI) * scale
}

function getPolygonEdgeVectors(polygon) {
  let edgeVectors = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    edgeVectors.push(getVectorFromPointToPoint(polygon[i], polygon[mod(i + 1, n)]))
  }
  return edgeVectors
}
const RESOLUTION = 180
function getAngleHistogram(polygon) {
  const histogram = Array(RESOLUTION).fill(0)
  const edgeVectors = getPolygonEdgeVectors(polygon)
  const polygonEdgeAngles = edgeVectors.map((e) => getAngleOfVector(e, false))
  const lengths = edgeVectors.map((e) => Math.sqrt(e[0] ** 2 + e[1] ** 2))
  for (let i = 0; i < polygonEdgeAngles.length; i++) {
    const index = Math.round(polygonEdgeAngles[i])
    histogram[index] += lengths[i]
  }
  return histogram
}

function getAngleHistogramForPolygons(polygons) {
  const histogram = Array(RESOLUTION).fill(0)
  for (let i = 0; i < polygons.length; i++) {
    const edgeVectors = getPolygonEdgeVectors(polygons[i])
    const polygonEdgeAngles = edgeVectors.map((e) => getAngleOfVector(e, false))
    const lengths = edgeVectors.map((e) => Math.sqrt(e[0] ** 2 + e[1] ** 2))
    for (let j = 0; j < polygonEdgeAngles.length; j++) {
      const index = Math.round(polygonEdgeAngles[j])
      histogram[index] += lengths[j]
    }
  }
  return histogram
}

export function getDominantAngleInPolygon(polygon) {
  const histogram = getAngleHistogram(polygon)
  const smoothedHistogram = gaussSmoothen(histogram, 5)
  return argMax(smoothedHistogram)
}

export function getDominantAngleForPolygons(polygons) {
  const histogram = getAngleHistogramForPolygons(polygons)
  const smoothedHistogram = gaussSmoothen(histogram, 5)
  return argMax(smoothedHistogram)
}

export function getAngleSign(normalizedVector1, normalizedVector2) {
  let outwardsNormal1
  outwardsNormal1 = [normalizedVector1[1], -normalizedVector1[0]]
  const dot = getDotProduct(outwardsNormal1, normalizedVector2)
  return Math.sign(dot)
}

export function getAnglesBetweenVectors(normalizedVectors, signed = false, radians = false) {
  const scale = radians ? 1 : 180 / Math.PI

  let angles = []
  const n = normalizedVectors.length
  let sign = 1.0
  for (let i = 0; i < n; i++) {
    const dotProduct = getDotProduct(normalizedVectors[mod(i - 1, n)], normalizedVectors[i])
    const clippedDotProduct = clipValue(dotProduct, -0.9999999999, 0.9999999999)
    if (signed) sign = getAngleSign(normalizedVectors[mod(i - 1, n)], normalizedVectors[i])

    const angle = sign * Math.acos(clippedDotProduct) * scale
    angles.push(angle)
  }
  return angles
}

export function getAnglesAtPolygonVertices(polygon) {
  const n = polygon.length
  const edgeVectorsNormalized = []
  for (let i = 0; i < n; i++) {
    edgeVectorsNormalized.push(normalizedVectorFromPoints(polygon[i], polygon[mod(i + 1, n)]))
  }
  return getAnglesBetweenVectors(edgeVectorsNormalized, true)
}

export function uniqifyList(list) {
  let unique = list.filter((item, i, ar) => ar.indexOf(item) === i)
  return unique
}

export function removeDuplicatePoints(polygon, threshold = 1e-2) {
  const n = polygon.length
  const trimmedPolygon = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[mod(i - 1, n)]
    const p1 = polygon[i]
    const dist = distance(p0, p1)
    if (dist > threshold) trimmedPolygon.push(p1)
  }
  return trimmedPolygon
}

export function removeLastPointInPolygonIfEqualsFirst(polygon) {
  const copiedPolygon = [...polygon]
  if (pointsAreEqual(polygon[0], polygon[polygon.length - 1], 0.1)) {
    copiedPolygon.pop()
  }
  return copiedPolygon
}

export function getPolygonCircumference(inputPolygon) {
  const polygon = removeLastPointInPolygonIfEqualsFirst(inputPolygon)
  const n = polygon.length
  const circumference = polygon.reduce((acc, p, i) => acc + pointPointDistance(polygon[i], polygon[mod(i + 1, n)]), 0)
  return circumference
}

export function getCrossProduct(vec1, vec2) {
  return vec1[0] * vec2[1] - vec1[1] * vec2[0]
}

export function distanceToCrash(shootingDirectionVec, shootingPoint, hitLine) {
  const INF = 1e9
  const [p2, p3] = hitLine
  const normalizedShootingVec = normalizeVector(shootingDirectionVec)
  const s0 = getDotProduct(getVectorFromPointToPoint(shootingPoint, p2), normalizedShootingVec)
  const s1 = getDotProduct(getVectorFromPointToPoint(shootingPoint, p3), normalizedShootingVec)

  const t0 = getCrossProduct(getVectorFromPointToPoint(shootingPoint, p2), normalizedShootingVec)
  const t1 = getCrossProduct(getVectorFromPointToPoint(shootingPoint, p3), normalizedShootingVec)

  if ((t0 >= 0 && t1 >= 0) || (t0 <= 0 && t1 <= 0)) {
    return INF
  }
  if (s0 < 0 && s1 < 0) {
    return INF
  }

  const s = (s1 * t0 - s0 * t1) / (t0 - t1)
  if (s < -NPD) {
    return INF
  }
  return s
}

export function projectPointToLineSegment(p, l0, l1, threshold = 1e-2) {
  const [x, y] = p
  const { x: ux, y: uy } = getUnitVector(l0, l1)
  const sStart = ux * l0[0] + uy * l0[1]
  const sEnd = ux * l1[0] + uy * l1[1]
  let s = ux * x + uy * y
  if (s < sStart + threshold || s > sEnd - threshold) return s - sStart < sEnd - s ? l0 : l1
  return [l0[0] + (s - sStart) * ux, l0[1] + (s - sStart) * uy]
}

export function polygonHasAcuteAngle(polygon) {
  const n = polygon.length
  const edgeVectors = polygon.map((p, i) => getVectorFromPointToPoint(p, polygon[(i + 1) % n]))
  const angles = edgeVectors.map((e, i) => angleBetweenVectors([-e[0], -e[1]], edgeVectors[(i + 1) % n]))
  const thresholdAngle = Math.atan(1 / 12.5)
  return angles.some((a) => a <= thresholdAngle)
}

export function getCenterOfMassOfPolygons(polygons) {
  let totalArea = 0
  let accumuluatedX = 0
  let accumulatedY = 0
  polygons.forEach((polygon) => {
    const area = polygonArea(polygon)
    const centerOfMass = getCenterOfMass(polygon)
    totalArea += area
    accumuluatedX += area * centerOfMass[0]
    accumulatedY += area * centerOfMass[1]
  })

  return [accumuluatedX / totalArea, accumulatedY / totalArea]
}

export function almostEqual(num1, num2, precision = 0.000000000000001) {
  // Similar to JSON.stringify precision
  return Math.abs(num1 - num2) < precision
}

export function pointsAlmostEqual(p1, p2, precision = 0.000000000000001) {
  return almostEqual(p1[0], p2[0], precision) && almostEqual(p1[1], p2[1], precision)
}

export function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
}
