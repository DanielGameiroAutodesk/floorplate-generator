import { isDefined } from "src/lib/array"

export const to360Degrees = (angleInDegrees: number | undefined) =>
  ((isDefined(angleInDegrees) && !isNaN(angleInDegrees) ? angleInDegrees : 0) + 360) % 360

export function isClockwise(poly: [number, number][]) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}
