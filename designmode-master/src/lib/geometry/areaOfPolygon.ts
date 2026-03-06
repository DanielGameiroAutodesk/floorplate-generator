import type { PolygonWithHolesXY, PolygonXY } from "./polygonXY"

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

export function areaOfPolygonWithHoles(polygonWithHoles: PolygonWithHolesXY) {
  return [polygonWithHoles.polygon, ...polygonWithHoles.holes].reduce((acc, p) => acc + areaOfPolygon(p), 0)
}
