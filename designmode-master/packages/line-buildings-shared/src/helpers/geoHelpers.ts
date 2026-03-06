import type { Polygon } from "../lineBuildingGenerator/lib/lineBuilding9000/BuildingTypes.js"
import type { Vec2 } from "../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"

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

export function getCWPolygon(polygon: Polygon) {
  if (isClockwise(polygon)) {
    return polygon
  } else {
    return reversePolygon(polygon)
  }
}

export function getCCWPolygon(polygon: Polygon) {
  if (isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function closePolygonIfNotClosed(polygon: Polygon) {
  if (polygon.length <= 1) return polygon
  const p0 = polygon[0]
  const p1 = polygon[polygon.length - 1]
  if (p0[0] === p1[0] && p0[1] === p1[1]) return polygon
  return [...polygon, polygon[0]]
}

export function getAngleXY(p0: Vec2, p1: Vec2, p2: Vec2) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

export function getBlockDistanceForSimpleCorner({ normalDist, angle }: { normalDist: number; angle: number }) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = normalDist / Math.cos(absAngle - Math.PI / 2)
    const dist2 = normalDist / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (normalDist * (1 - Math.cos(absAngle))) / Math.sin(absAngle)
  return Math.abs(shift)
}
