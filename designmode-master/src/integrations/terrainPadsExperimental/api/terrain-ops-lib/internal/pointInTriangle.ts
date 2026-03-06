import type { Vec3 } from "./utils"

function isBetween(a: Vec3, b: Vec3, c: Vec3) {
  // adapted from https://stackoverflow.com/questions/328107/how-can-you-determine-a-point-is-between-two-other-points-on-a-line-segment
  const crossproduct = (c.y - a.y) * (b.x - a.x) - (c.x - a.x) * (b.y - a.y)

  if (Math.abs(crossproduct) > Number.EPSILON) return false

  const dotProduct = (c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)
  if (dotProduct < 0) return false

  const squaredLengthBA = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)
  if (dotProduct > squaredLengthBA) return false

  return true
}

type Point2D = number[]
function isBetween2D(a: Point2D, b: Point2D, c: Point2D) {
  // adapted from https://stackoverflow.com/questions/328107/how-can-you-determine-a-point-is-between-two-other-points-on-a-line-segment
  const crossproduct = (c[1] - a[1]) * (b[0] - a[0]) - (c[0] - a[0]) * (b[1] - a[1])

  if (Math.abs(crossproduct) > Number.EPSILON) return false

  const dotProduct = (c[0] - a[0]) * (b[0] - a[0]) + (c[1] - a[1]) * (b[1] - a[1])
  if (dotProduct < 0) return false

  const squaredLengthBA = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
  if (dotProduct > squaredLengthBA) return false

  return true
}

export function pointInPolygon(point: Vec3, polygon: Vec3[]) {
  // ray-casting algorithm based on
  // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

  const x = point.x
  const y = point.y

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x
    let yi = polygon[i].y
    let xj = polygon[j].x
    let yj = polygon[j].y

    let intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside

    // check if point is on edge
    if (!intersect && isBetween(polygon[i], polygon[j], point)) {
      return true
    }
  }

  return inside
}
export function pointInPolygon2D(x: number, y: number, polygon: number[][]) {
  // ray-casting algorithm based on
  // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][0]
    let yi = polygon[i][1]
    let xj = polygon[j][0]
    let yj = polygon[j][1]

    let intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside

    // check if point is on edge
    if (!intersect && isBetween2D(polygon[i], polygon[j], [x, y])) {
      return true
    }
  }

  return inside
}
