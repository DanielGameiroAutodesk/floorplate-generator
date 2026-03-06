import type { Transform } from "@spacemakerai/element-types"
import type { Coord2D } from "src/lib/geometry/geometryTypes"
import type { Polygon } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"

export function getTranslationMatrix(x: number, y: number, z: number): Transform {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]
}

export function pointPointDistance(point1: number[], point2: number[]) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

export function closePolygon(polygon: Polygon): Polygon {
  return pointPointDistance(polygon[0], polygon[polygon.length - 1]) > 0 ? polygon.concat([polygon[0]]) : polygon
}

export function openPolygon(polygon: Polygon): Polygon {
  return pointPointDistance(polygon[0], polygon[polygon.length - 1]) > 0
    ? polygon
    : polygon.slice(0, polygon.length - 1)
}

export function isClockwise(poly: Polygon) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
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

export function getClockwisePolygon(polygon: Polygon) {
  if (!isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function mergeFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const len = arrays.reduce((acc, arr) => {
    acc += arr.length
    return acc
  }, 0)
  let result = new Float32Array(len)
  let currentIndex = 0
  arrays.forEach((arr) => {
    result.set(arr, currentIndex)
    currentIndex += arr.length
  })
  return result
}

export function mergeUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((acc, arr) => {
    acc += arr.length
    return acc
  }, 0)
  let result = new Uint8Array(len)
  let currentIndex = 0
  arrays.forEach((arr) => {
    result.set(arr, currentIndex)
    currentIndex += arr.length
  })
  return result
}

export type PolygonXY = { x: number; y: number }[]

export function ensurePolygonIsXY(polygon: Polygon | PolygonXY): PolygonXY {
  if (polygon.length && Array.isArray(polygon[0])) {
    return (polygon as Polygon).map(([x, y]) => ({ x, y }))
  }
  return polygon as PolygonXY
}

export function alignPolygonWithDirection(polygon: Polygon, direction: Coord2D): Polygon {
  const [dx, dy] = direction
  return polygon.map((point) => {
    const [px, py] = point
    const x = px * dx + py * dy
    const y = -px * dy + py * dx
    return [x, y]
  })
}

export function alignPolygonXYWithDirection(polygon: PolygonXY, direction: Coord2D): PolygonXY {
  const [dx, dy] = direction
  return polygon.map((point) => {
    const { x: px, y: py } = point
    const x = px * dx + py * dy
    const y = -px * dy + py * dx
    return { x, y }
  })
}

export function getBoundingBoxOfPolygon(polygon: PolygonXY) {
  const minX = polygon.reduce((minX: number, point) => Math.min(point.x, minX), Infinity)
  const maxX = polygon.reduce((maxX: number, point) => Math.max(point.x, maxX), -Infinity)
  const minY = polygon.reduce((minY: number, point) => Math.min(point.y, minY), Infinity)
  const maxY = polygon.reduce((maxY: number, point) => Math.max(point.y, maxY), -Infinity)
  return { minX, maxX, minY, maxY }
}

export function getBoundingBoxOfPolygons(polygons: PolygonXY[]) {
  return getBoundingBoxOfPolygon(polygons.flat())
}

export function calculateCenterPointAndScale(firstFloorPolygons: PolygonXY[], viewBoxWidth: number, padding: number) {
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygons(firstFloorPolygons.map(ensurePolygonIsXY))
  const centerX = (maxX + minX) / 2
  const centerY = (maxY + minY) / 2
  const centerPoint = { x: centerX, y: centerY }
  const length = maxX - minX
  let scale = (viewBoxWidth - padding) / length
  let viewBoxHeight = ((maxY - minY) / length) * viewBoxWidth
  if (viewBoxHeight > viewBoxWidth) {
    scale = (scale * viewBoxWidth) / viewBoxHeight
  }
  return { centerPoint, scale, viewBoxHeight: viewBoxHeight }
}
