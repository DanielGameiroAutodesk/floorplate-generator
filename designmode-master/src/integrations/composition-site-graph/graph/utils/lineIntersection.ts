import type { Vector2 } from "three"

export type Intersection = {
  x: number
  y: number
  seg1: boolean
  seg2: boolean
  ua: number
  ub: number
}

export function lineIntersectVectors(aStart: Vector2, aEnd: Vector2, bStart: Vector2, bEnd: Vector2) {
  return lineIntersect(aStart.x, aStart.y, aEnd.x, aEnd.y, bStart.x, bStart.y, bEnd.x, bEnd.y)
}

export function lineIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): Intersection | undefined {
  let ua,
    ub,
    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (denom === 0) {
    return undefined
  }
  ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
  ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom
  return {
    x: x1 + ua * (x2 - x1),
    y: y1 + ua * (y2 - y1),
    seg1: ua > 0.0001 && ua < 0.9999,
    seg2: ub > 0.0001 && ub < 0.9999,
    ua,
    ub,
  }
}
