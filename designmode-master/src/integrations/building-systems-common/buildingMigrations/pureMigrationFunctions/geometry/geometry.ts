export type Point = [number, number]
export type Polygon = Point[]
export type PointXY = { x: number; y: number }
export type PolygonXY = PointXY[]
export type PolygonWithHolesXY = { polygon: PolygonXY; holes: PolygonXY[] }
export function removeDuplicateLastPoint(polygon: Polygon) {
  const n = polygon.length
  const duplicate = polygon[0][0] === polygon[n - 1][0] && polygon[0][1] === polygon[n - 1][1]
  if (duplicate) return polygon.slice(0, n - 1)
  return polygon
}

export function areaOfPolygon(polygon: PolygonXY) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0.x * p1.y - p1.x * p0.y)
  }
  return area
}

export function isPolygonClockwise(poly: PolygonXY) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y),
    0,
  )
  return sum > 0
}

export function isPointInsidePolygon(point: PointXY, polygon: PolygonXY) {
  let { x, y } = point
  const n = polygon.length

  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    let xi = polygon[i].x
    let yi = polygon[i].y
    let xj = polygon[j].x
    let yj = polygon[j].y

    let intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function makePolygonCounterClockwise(polygon: PolygonXY) {
  if (isPolygonClockwise(polygon)) return [...polygon].reverse()
  return polygon
}
