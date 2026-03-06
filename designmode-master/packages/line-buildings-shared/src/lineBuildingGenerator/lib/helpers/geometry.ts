import type { Point, Polygon } from "../lineBuilding9000/BuildingTypes.js"

export function addVectorToPoint(point: Point, vector: number[]): Point {
  return [point[0] + vector[0], point[1] + vector[1]]
}

export function scale(vector: Point, scalar: number) {
  return [scalar * vector[0], scalar * vector[1]]
}

export function vectorLength(vector: Point) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2))
}

export function normalizeVector(vector: Point): Point {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length]
}

export function movePointAlongVector(point: Point, vector: Point, distance: number) {
  const moveVector = scale(normalizeVector(vector), distance)
  return addVectorToPoint(point, moveVector)
}

export function pointPointDistance(point1: Point, point2: Point): number {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

export function getVectorFromPointToPoint(startPoint: Point, endPoint: Point): Point {
  return [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]]
}

export function getNormalizedVectorFromPointToPoint(p1: Point, p2: Point) {
  return getVectorFromPointToPoint(p1, p2).map((v) => v / pointPointDistance(p1, p2)) as Point
}

export function addVectorsToPoint(point: Point, ...rest: any): Point {
  let x = point[0]
  let y = point[1]
  for (let i = 0; i < rest.length - 1; i += 2) {
    const vector = rest[i]
    const scalar = rest[i + 1]
    x += scalar * vector[0]
    y += scalar * vector[1]
  }
  return [x, y]
}

export function getAngle(p0: Point, p1: Point, p2: Point) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function determinant(vector1: Point, vector2: Point) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
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

export function isClockwise(poly: Polygon) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

export function reversePolygon(polygon: Polygon) {
  let reversedPolygon = []
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

export function simpleUnitVector(startPoint: Point, endPoint: Point) {
  return normalizeVector(getVectorFromPointToPoint(startPoint, endPoint))
}

export function dotProduct(vector1: Point, vector2: Point) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1]
}
