import {
  addVectorToPoint,
  determinant,
  getVectorFromPointToPoint,
  scale,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

export const SNAP_DISTANCE = 0.01

export function distance(p1, p2) {
  const vec = [p2[0] - p1[0], p2[1] - p1[1]]
  return Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2))
}

export function getNormVector(p1, p2) {
  const vec = [p2[0] - p1[0], p2[1] - p1[1]]
  const len = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2))
  return len < 1e-8 ? vec : [vec[0] / len, vec[1] / len]
}

export function linesIntersectionPoint(s1_start, s1_end, s2_start, s2_end) {
  const v1 = getVectorFromPointToPoint(s1_end, s1_start)
  const v2 = getVectorFromPointToPoint(s2_start, s2_end)
  const v3 = getVectorFromPointToPoint(s2_start, s1_start)
  const d = determinant(v1, v2)
  const t = determinant(v3, v2) / d
  return addVectorToPoint(s1_start, scale(getVectorFromPointToPoint(s1_start, s1_end), t))
}

export function getAngle(p1, p2, p3) {
  const vec1 = [p1[0] - p2[0], p1[1] - p2[1]]
  const vec2 = [p3[0] - p2[0], p3[1] - p2[1]]
  const dot = vec1[0] * vec2[0] + vec1[1] * vec2[1]
  const length1 = Math.sqrt(Math.pow(vec2[0], 2) + Math.pow(vec2[1], 2))
  const length2 = Math.sqrt(Math.pow(vec1[0], 2) + Math.pow(vec1[1], 2))
  const productLength = length2 * length1
  const cosAngle = Math.max(Math.min(productLength > 0 ? dot / productLength : 1, 1), -1)
  const orth = [-vec2[1], vec2[0]]
  const dotOrth = vec1[0] * orth[0] + vec1[1] * orth[1]
  const sign = dotOrth < 0 ? 1 : -1
  return sign * Math.acos(cosAngle)
}

export function getPullBackDistance(angle, width, otherWidth) {
  const absAngle = Math.abs(angle)
  return Math.max(0, (otherWidth + width * Math.cos(absAngle)) / (2 * Math.sin(absAngle)))
}

export function getRelativeEdgeProps(edge, vertices, vertexId) {
  const flipped = edge.end === vertexId
  const start = flipped
    ? [vertices[edge.end].x, vertices[edge.end].y]
    : [vertices[edge.start].x, vertices[edge.start].y]
  const end = flipped ? [vertices[edge.start].x, vertices[edge.start].y] : [vertices[edge.end].x, vertices[edge.end].y]

  const direction = getNormVector(start, end)
  const normal = [-direction[1], direction[0]]
  return {
    direction,
    normal,
    point: end,
    width: edge.width,
    length: distance(start, end),
    edgeId: edge.id,
    otherVertexId: flipped ? edge.start : edge.end,
    flipped,
  }
}

export function getNeighbourEdgeProps(edges, vertices, vertexId) {
  const neighbourEdges = Object.values(edges).filter((edge) => edge.start === vertexId || edge.end === vertexId)
  if (neighbourEdges.length !== 2) return null

  const center = [vertices[vertexId].x, vertices[vertexId].y]
  const first = getRelativeEdgeProps(neighbourEdges[0], vertices, vertexId)
  const second = getRelativeEdgeProps(neighbourEdges[1], vertices, vertexId)

  const signedAngle = getAngle(first.point, center, second.point)
  const right = signedAngle > 0 ? first : second
  const left = signedAngle > 0 ? second : first

  const angle = Math.abs(signedAngle)
  return { center, right, left, angle }
}

export function removeDegeneratePoints(polygon) {
  if (!polygon || polygon.length === 0) return []
  let newPolygon = [polygon[0]]
  for (let i = 1; i < polygon.length; i++) {
    if (distance(polygon[i], newPolygon[newPolygon.length - 1]) > 10e-6) newPolygon.push(polygon[i])
  }
  return newPolygon
}
