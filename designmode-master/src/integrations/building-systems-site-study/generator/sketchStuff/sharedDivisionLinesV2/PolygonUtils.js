import { getCCWPolygon, polygonArea } from "./geometry.js"

const NPD = 1e-6

function determinant(vector1, vector2) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}

function getVectorFromPointToPoint(startPoint, endPoint) {
  return [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]]
}

function addVectorToPoint(point, vector) {
  return [point[0] + vector[0], point[1] + vector[1]]
}

function scale(vector, scalar) {
  return [scalar * vector[0], scalar * vector[1]]
}

function pointPointDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

function vectorLength(vector) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2))
}

function normalizeVector(vector) {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length]
}

function rotate(vector, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [cos * vector[0] - sin * vector[1], sin * vector[0] + cos * vector[1]]
}

function lineSegmentsIntersect(s1_start, s1_end, s2_start, s2_end, countEndpoints = false) {
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

function pointInPolygon(point, polygon, countBoundary) {
  let closedPolygon = polygon
  if (pointPointDistance(polygon[0], polygon[polygon.length - 1]) > NPD) closedPolygon = closePolygon(polygon)
  const onBoundary = closedPolygon
    .slice(0, closedPolygon.length - 1)
    .some((_, index) => pointOnLineSegment(point, closedPolygon[index], closedPolygon[index + 1]))
  if (onBoundary) return countBoundary

  return isPointInPolygonInterior(point, polygon)
}

function copyPolygon(polygon) {
  let copiedPolygon = []
  for (let i = 0; i < polygon.length; i++) {
    copiedPolygon.push([...polygon[i]])
  }
  return copiedPolygon
}

function polygonIsClosed(polygon) {
  return pointPointDistance(polygon[0], polygon[polygon.length - 1]) < NPD
}

function closePolygon(polygon) {
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

function _dot(v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1]
}

export function pointsOnLine(p0, p1, all_points, snapDistance = 0.05) {
  const xmin = Math.min(p0[0], p1[0]) - snapDistance,
    xmax = Math.max(p0[0], p1[0]) + snapDistance,
    ymin = Math.min(p0[1], p1[1]) - snapDistance,
    ymax = Math.max(p0[1], p1[1]) + snapDistance

  const s_vec = [p1[0] - p0[0], p1[1] - p0[1]],
    t_vec = [s_vec[1], -s_vec[0]]
  const t_base = _dot(t_vec, p0),
    s_min = _dot(s_vec, p0),
    s_max = _dot(s_vec, p1),
    t_length = Math.pow(Math.pow(t_vec[0], 2) + Math.pow(t_vec[1], 2), 0.5),
    t_max = snapDistance * t_length

  const sorted_points_on_line = []
  all_points.forEach((point) => {
    if (xmin <= point[0] && point[0] <= xmax && ymin <= point[1] && point[1] <= ymax) {
      const s_val = _dot(point, s_vec),
        t_val = _dot(point, t_vec) - t_base
      if (Math.abs(t_val) < t_max && s_min < s_val && s_val < s_max) {
        let insertIndex = 0
        for (let i = 0; i < sorted_points_on_line.length; i++) {
          if (s_val > _dot(sorted_points_on_line[i], s_vec)) insertIndex++
          else break
        }
        sorted_points_on_line.splice(insertIndex, 0, point)
      }
    }
  })

  return sorted_points_on_line
}

function snapPointsMutable(points, snappingDistance) {
  const nPoints = points.length
  points.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  let k = 1
  for (let i = 0; i < nPoints - 1; i++) {
    const p1 = points[i]
    for (let j = k; j < nPoints - 1; j++) {
      const p2 = points[j]
      if (p2[0] > p1[0] + snappingDistance) {
        break
      }
      if (p2[0] < p1[0] - snappingDistance) {
        k = j
        continue
      }
      if ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 < snappingDistance ** 2) {
        p1[0] = p2[0]
        p1[1] = p2[1]
      }
    }
  }
}

function clipLoops(_poly) {
  let poly = JSON.parse(JSON.stringify(_poly))
  const loops = []
  while (
    poly.map(JSON.stringify).some((p, i, l) => {
      const firstOccurrenceIndex = l.indexOf(p)
      if (firstOccurrenceIndex !== i) {
        loops.push(poly.splice(firstOccurrenceIndex, i - firstOccurrenceIndex))
        return true
      }
      return false
    })
    // eslint-disable-next-line
  ) {}
  if (poly.length > 2) loops.push(poly)
  return loops
}

export function snapPointsAndClipAwayLoops(polygon, snapDist) {
  const points = polygon.map((point) => point)
  snapPointsMutable(points, snapDist)

  const polygonWithInserts = polygon
    .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))
    .flatMap((p, i, l) => [p, ...pointsOnLine(p, l[(i + 1) % l.length], points, snapDist)])
    .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))

  return (
    clipLoops(polygonWithInserts)
      .map(getCCWPolygon)
      .sort((a, b) => polygonArea(b) - polygonArea(a))[0] || []
  )
}

export function snapPointsAndSplitLoops(polygon, snapDist) {
  const points = polygon.map((point) => point)
  snapPointsMutable(points, snapDist)

  const polygonWithInserts = polygon
    .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))
    .flatMap((p, i, l) => [p, ...pointsOnLine(p, l[(i + 1) % l.length], points, snapDist)])
    .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))

  return clipLoops(polygonWithInserts).map(getCCWPolygon)
}
