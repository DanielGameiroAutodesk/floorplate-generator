import { Matrix4, Vector3 } from "three"

/*
 * Finds intersection points (in XY-plane) between a line segment and the given grid
 */

export type GridGlobalSettings = {
  angle: number
  stepSize: number
  origin: [number, number]
}

export default function lineSegmentIntersectionsWithGrid(
  grid: GridGlobalSettings | undefined,
  start: Vector3,
  end: Vector3,
): Vector3[] {
  if (!grid) return []

  const {
    origin: [x, y],
    angle,
    stepSize,
  } = grid
  const translate = new Matrix4().makeTranslation(-x, -y, 0)
  const rotate = new Matrix4().makeRotationZ(-angle)

  const transform = rotate.clone().multiply(translate)

  const transformBack = transform.clone().invert()
  const convertedStart = start.clone().applyMatrix4(transform)
  const convertedEnd = end.clone().applyMatrix4(transform)

  const minX = Math.min(convertedStart.x, convertedEnd.x)
  const minY = Math.min(convertedStart.y, convertedEnd.y)
  const maxX = Math.max(convertedStart.x, convertedEnd.x)
  const maxY = Math.max(convertedStart.y, convertedEnd.y)

  /*
  Line function: y = ax + b

  a = (y1-y0)/(x1-x0)
  b = y - ax
  */

  const verticalLine = Math.abs(convertedStart.x - convertedEnd.x) < 0.000001
  const horizontalLine = Math.abs(convertedStart.y - convertedEnd.y) < 0.000001
  const a = (convertedEnd.y - convertedStart.y) / (convertedEnd.x - convertedStart.x)
  const b = convertedStart.y - a * convertedStart.x

  const yAtX = (x: number) => (horizontalLine ? convertedStart.y : a * x + b)
  const xAtY = (y: number) => (verticalLine ? convertedStart.x : (y - b) / a)

  const intersectionPoints: [number, number][] = []

  let currentX = (Math.floor(minX / stepSize) + 1) * stepSize
  while (currentX <= maxX) {
    intersectionPoints.push([currentX, yAtX(currentX)])
    currentX += stepSize
  }

  let currentY = (Math.floor(minY / stepSize) + 1) * stepSize
  while (currentY <= maxY) {
    intersectionPoints.push([xAtY(currentY), currentY])
    currentY += stepSize
  }

  return intersectionPoints.map(([x, y]) => {
    return new Vector3(x, y, 0).applyMatrix4(transformBack)
  })
}
