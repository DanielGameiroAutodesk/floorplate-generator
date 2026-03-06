import polygonClipping from "polygon-clipping"
import { pointsOnLine } from "./PolygonUtils.js"
const NPD = 1e-6

export function dotProduct(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1]
}

export function getUnitNormalVector(p0, p1) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
  return [(y0 - y1) / length, (x1 - x0) / length]
}

export function getUnitVector(p0, p1) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
  return [(x1 - x0) / length, (y1 - y0) / length]
}

export function getVector(p0, p1) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  return [x1 - x0, y1 - y0]
}

export function movePointAlongVector(point, vector, distance) {
  return [point[0] + vector[0] * distance, point[1] + vector[1] * distance]
}

export function addAndScale(p, v, scale) {
  return [p[0] + scale * v[0], p[1] + scale * v[1]]
}

export function pointPointDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

function vectorLength(vector) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2))
}

export function normalizeVector(vector) {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length]
}

export function scale(vector, scalar) {
  return [scalar * vector[0], scalar * vector[1]]
}

export function addVectorToPoint(point, vector) {
  return [point[0] + vector[0], point[1] + vector[1]]
}

export const clamp = (num, min, max) => Math.min(Math.max(num, min), max)

export function getAngleBetweenPoints(p1, p2, p3) {
  const vec1 = getUnitNormalVector(p2, p1)
  const vec2 = getUnitNormalVector(p2, p3)
  const rotated90 = [-vec1[1], vec1[0]]
  const dot = clamp(dotProduct(vec1, vec2), -1, 1)
  const res = Math.acos(dot)
  return dotProduct(vec2, rotated90) > 0 ? res : 2 * Math.PI - res
}

export function isClockwise(poly) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

export function getCentroid(polygon) {
  return polygon.reduce((acc, p, i, l) => [acc[0] + p[0] / l.length, acc[1] + p[1] / l.length], [0, 0])
}

function roundPolygon(polygon, noDecimals) {
  return polygon
    .map((p) => [+p[0].toFixed(noDecimals), +p[1].toFixed(noDecimals)])
    .filter((p, i, l) => p[0] !== l[(i + 1) % l.length][0] || p[1] !== l[(i + 1) % l.length][1])
}

export function getPolygonDifference(mainPolygon, clipPolygonsWithHoles) {
  const cleanedMain = roundPolygon(mainPolygon, 1)
  const cleanedClipLoos = clipPolygonsWithHoles.map((cp) => ({ ...cp, rings: cp.rings.map((p) => roundPolygon(p, 1)) }))
  //if any points from mainpolygon happen to be on the border of clipPolygonsWithHoles: insert them
  //to clipPolygonsWithHoles due to limitation in the polygonClipping library
  const withNewPoints = cleanedClipLoos.map((clipLoop) => ({
    ...clipLoop,
    rings: clipLoop.rings.map((poly) => {
      return poly
        .flatMap((p, i, l) => {
          return [p, ...pointsOnLine(p, l[(i + 1) % l.length], cleanedMain)]
        })
        .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))
    }),
  }))

  return polygonClipping
    .difference(
      [cleanedMain],
      withNewPoints.map((p) => p.rings),
    )
    .map((p) => p[0])
}

export function getPolygonUnion(polygons) {
  if (!polygons.length) return []
  const cleaned = polygons.map((p) => roundPolygon(p, 3))
  return polygonClipping.union(cleaned.map((polygon) => [polygon]))
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

function reversePolygon(polygon) {
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

export function simpleUnitVector(startPoint, endPoint) {
  return normalizeVector(getVector(startPoint, endPoint))
}

export function determinant(vector1, vector2) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}

export const mod = (n, m) => ((n % m) + m) % m

export function argMin(array) {
  let argmin = 0
  let min_value = 99999999999999
  for (let i = 0; i < array.length; i++) {
    if (array[i] < min_value) {
      argmin = i
      min_value = array[i]
    }
  }
  return argmin
}

export function argMax(array) {
  let argmax = 0
  let max_value = -99999999999999
  for (let i = 0; i < array.length; i++) {
    if (array[i] > max_value) {
      argmax = i
      max_value = array[i]
    }
  }
  return argmax
}

export function getDotProduct(vec1, vec2) {
  return vec1[0] * vec2[0] + vec1[1] * vec2[1]
}

export function getVectorFromPointToPoint(startPoint, endPoint) {
  return [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]]
}

export function getCrossProduct(vec1, vec2) {
  return vec1[0] * vec2[1] - vec1[1] * vec2[0]
}

export function lineSegmentsIntersectionPoint(s1_start, s1_end, s2_start, s2_end, countEndpoints = false) {
  const v1 = getVectorFromPointToPoint(s1_end, s1_start)
  const v2 = getVectorFromPointToPoint(s2_start, s2_end)
  const v3 = getVectorFromPointToPoint(s2_start, s1_start)
  const normalizedDeterminant = determinant(normalizeVector(v1), normalizeVector(v2))
  if (Math.abs(normalizedDeterminant) < 0.0001) {
    return null
  }
  const d = determinant(v1, v2)
  const t = determinant(v3, v2) / d
  const u = determinant(v1, v3) / d
  const intersectionPoint = addVectorToPoint(s1_start, scale(getVectorFromPointToPoint(s1_start, s1_end), t))
  if (!countEndpoints) {
    if ([s1_start, s1_end, s2_start, s2_end].some((point) => 0.01 > pointPointDistance(point, intersectionPoint)))
      return null
  }
  if (t >= 0 && u >= 0 && t <= 1 && u <= 1) return intersectionPoint
  return null
}

function rotate(vector, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [cos * vector[0] - sin * vector[1], sin * vector[0] + cos * vector[1]]
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

export function pointInPolygon(point, polygon, countBoundary) {
  let closedPolygon = polygon
  if (pointPointDistance(polygon[0], polygon[polygon.length - 1]) > NPD) closedPolygon = closePolygon(polygon)
  const onBoundary = closedPolygon
    .slice(0, closedPolygon.length - 1)
    .some((_, index) => pointOnLineSegment(point, closedPolygon[index], closedPolygon[index + 1]))
  if (onBoundary) return countBoundary

  return isPointInPolygonInterior(point, polygon)
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

function pointOnLineSegment(point, lineStart, lineEnd) {
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

function copyPolygon(polygon) {
  let copiedPolygon = []
  for (let i = 0; i < polygon.length; i++) {
    copiedPolygon.push([...polygon[i]])
  }
  return copiedPolygon
}

function closePolygon(polygon) {
  let closedPolygon = copyPolygon(polygon)
  closedPolygon.push(polygon[0])
  return closedPolygon
}

export function isLineSegmentPartiallyInsidePolygon(line, polygon, countEndPoints = false) {
  if (pointInPolygon(line[0], polygon, countEndPoints) || pointInPolygon(line[1], polygon, countEndPoints)) return true

  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i]
    const p2 = polygon[mod(i + 1, n)]
    if (lineSegmentsIntersectionPoint(line[0], line[1], p1, p2, false)) {
      return true
    }
  }

  return false
}
