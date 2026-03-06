import { mod } from "./numpy"
import type { Point, Polygon } from "src/integrations/building-systems-common/lib-generators/parkingGenerator/parking"

const NPD = 1e-6

export function isClockwise(poly: [number, number][]) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

export function vectorLength(vector: number[]) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2))
}

function dotProduct(vector1: number[], vector2: number[]) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1]
}

export function angleBetweenVectors(vector1: number[], vector2: number[]) {
  const cos = dotProduct(vector1, vector2) / (vectorLength(vector1) * vectorLength(vector2))
  return Math.acos(Math.max(-1, Math.min(cos, 1)))
}

export function reversePolygon(polygon: Polygon) {
  let reversedPolygon: Polygon = []
  for (let i = 0; i < polygon.length; i++) {
    reversedPolygon.push(polygon[polygon.length - i - 1])
  }
  return reversedPolygon
}

export function getCCWPolygon(polygon: Polygon) {
  if (isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function getVectorFromPointToPoint(startPoint: number[], endPoint: number[]) {
  return [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]]
}

export function polygonHasAcuteAngle(polygon: Polygon) {
  const n = polygon.length
  const edgeVectors = polygon.map((p, i) => getVectorFromPointToPoint(p, polygon[(i + 1) % n]))
  const angles = edgeVectors.map((e, i) => angleBetweenVectors([-e[0], -e[1]], edgeVectors[(i + 1) % n]))
  const thresholdAngle = Math.atan(1 / 12.5)
  return angles.some((a) => a <= thresholdAngle)
}

export function cleanPolygon(polygon: Polygon) {
  const cleanedPolygon = makePolygonNonSelfClosing(getCCWPolygon(polygon).map(fixDecimalPoints))
  if (polygonHasAcuteAngle(cleanedPolygon)) console.warn("Acute angles in polygon: ", JSON.stringify(cleanedPolygon))
  return cleanedPolygon
}

export function fixDecimalPoints(point: Point): Point {
  const [x, y] = point
  return [parseFloat(x.toFixed(3)), parseFloat(y.toFixed(3))]
}

export function makePolygonNonSelfClosing(polygon: Polygon): Polygon {
  return polygon.filter((p, i, l) => p[0] !== l[(i + 1) % l.length][0] || p[1] !== l[(i + 1) % l.length][1])
}

export function determinant(vector1: number[], vector2: number[]) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}

export function pointPointDistance(point1: Point, point2: Point) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

export function scale(vector: number[], scalar: number) {
  return [scalar * vector[0], scalar * vector[1]]
}

export function addVectorToPoint(point: Point, vector: number[]): Point {
  return [point[0] + vector[0], point[1] + vector[1]]
}

export function normalizeVector(vector: number[]) {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length]
}

export function movePointAlongVector(point: Point, vector: number[], distance: number) {
  const moveVector = scale(normalizeVector(vector), distance)
  return addVectorToPoint(point, moveVector)
}

export function polygonArea(poly: Polygon) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    area += determinant(p1, p2)
  }
  return 0.5 * Math.abs(area)
}

export function getDotProduct(vec1: number[], vec2: number[]) {
  return vec1[0] * vec2[0] + vec1[1] * vec2[1]
}

export function getAngleSign(normalizedVector1: number[], normalizedVector2: number[]) {
  let outwardsNormal1
  outwardsNormal1 = [normalizedVector1[1], -normalizedVector1[0]]
  const dot = getDotProduct(outwardsNormal1, normalizedVector2)
  return Math.sign(dot)
}

export function clipValue(value: number, lowerLimit: number, upperLimit: number) {
  if (value < lowerLimit) return lowerLimit
  if (value > upperLimit) return upperLimit
  return value
}

export function getAnglesBetweenVectors(normalizedVectors: number[][], signed = false, radians = false) {
  const scale = radians ? 1 : 180 / Math.PI

  let angles: number[] = []
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

export function normalizedVectorFromPoints(point1: number[], point2: number[]) {
  const vector = [point2[0] - point1[0], point2[1] - point1[1]]
  return normalizeVector(vector)
}

export function getAnglesAtPolygonVertices(polygon: Polygon) {
  const n = polygon.length
  const edgeVectorsNormalized: number[][] = []
  for (let i = 0; i < n; i++) {
    edgeVectorsNormalized.push(normalizedVectorFromPoints(polygon[i], polygon[mod(i + 1, n)]))
  }
  return getAnglesBetweenVectors(edgeVectorsNormalized, true)
}

function triangleArea(p1: number[], p2: number[], p3: number[]) {
  return 0.5 * Math.abs(p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]))
}

export function pointToLineDistance(point: Point, line: Point[]) {
  return (2 * triangleArea(point, line[0], line[1])) / pointPointDistance(line[0], line[1])
}

export function getNormVector(p1: number[], p2: number[]) {
  const vec = [p2[0] - p1[0], p2[1] - p1[1]]
  const len = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2))
  return len < 1e-8 ? vec : [vec[0] / len, vec[1] / len]
}

export function pullBackMidPoint(p1: number[], p2: number[], p3: number[], dist: number): Point {
  const edgeVec1 = getNormVector(p1, p2)
  const edgeVec2 = getNormVector(p2, p3)
  const offsetVec1 = [-edgeVec1[1], edgeVec1[0]]
  const offsetVec2 = [-edgeVec2[1], edgeVec2[0]]

  const resVec = normalizeVector([offsetVec1[0] + offsetVec2[0], offsetVec1[1] + offsetVec2[1]])
  return [p2[0] - resVec[0] * dist, p2[1] - resVec[1] * dist]
}

export function copyPolygon(polygon: Polygon) {
  let copiedPolygon: Polygon = []
  for (let i = 0; i < polygon.length; i++) {
    copiedPolygon.push([...polygon[i]])
  }
  return copiedPolygon
}

export function getCrossProduct(vec1: number[], vec2: number[]) {
  return vec1[0] * vec2[1] - vec1[1] * vec2[0]
}

export function distanceToCrash(shootingDirectionVec: number[], shootingPoint: number[], hitLine: number[][]) {
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

export function simpleUnitVector(startPoint: number[], endPoint: number[]) {
  return normalizeVector(getVectorFromPointToPoint(startPoint, endPoint))
}

export function closePolygon(polygon: Polygon): Polygon {
  return pointPointDistance(polygon[0], polygon[polygon.length - 1]) > 0 ? polygon.concat([polygon[0]]) : polygon
}

export function openPolygon(polygon: Polygon): Polygon {
  return pointPointDistance(polygon[0], polygon[polygon.length - 1]) > 0
    ? polygon
    : polygon.slice(0, polygon.length - 1)
}
