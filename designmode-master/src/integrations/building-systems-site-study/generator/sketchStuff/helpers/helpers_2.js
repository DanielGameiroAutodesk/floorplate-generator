import { getCrossProduct, getVectorFromPointToPoint, normalizeVector, pointPointDistance } from "./geometry.js"
import { getDotProduct, mod } from "./numpy.js"

const PRECISION = 1e-3
const INF = 1e9

export function getEdgeLength(edge, vertices) {
  const p1 = [vertices[edge.start].x, vertices[edge.start].y]
  const p2 = [vertices[edge.end].x, vertices[edge.end].y]
  return pointPointDistance(p1, p2)
}

export function getVertexEdgeMap(vertices, edges) {
  const map = {}
  Object.keys(vertices).forEach((id) => (map[id] = []))
  Object.values(edges).forEach((edge) => {
    map[edge.start].push(edge.id)
    map[edge.end].push(edge.id)
  })
  return map
}

export function getNormalizedVectorFromPointToPoint(p1, p2) {
  return getVectorFromPointToPoint(p1, p2).map((v) => v / pointPointDistance(p1, p2))
}

function distanceToCrash(shootingDirectionVec, shootingPoint, hitLine) {
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
  if (s < -PRECISION) {
    return INF
  }
  return s
}

export function distanceToPolygonBoundary(shootingVec, shootingPoint, polygon) {
  const n = polygon.length
  const distances = polygon.map((p, i) => distanceToCrash(shootingVec, shootingPoint, [p, polygon[mod(i + 1, n)]]))
  const minDistance = Math.min(...distances)
  if (minDistance < INF) {
    return minDistance
  }

  const reversedShootingVec = [shootingVec[0], -shootingVec[1]]
  const negativeDistances = polygon.map(
    (p, i) => -distanceToCrash(reversedShootingVec, shootingPoint, [p, polygon[mod(i + 1, n)]]),
  )

  return Math.max(...negativeDistances)
}
