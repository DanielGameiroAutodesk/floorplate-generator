import type { Vec2 } from "../../../lineBuilding9000/graphLineHelpers.js"
import type { Alignment } from "./circulation.js"

export function getBlockDistanceForSimpleCorner(width: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = (0.5 * width) / Math.cos(absAngle - Math.PI / 2)
    const dist2 = (0.5 * width) / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (0.5 * width - 0.5 * width * Math.cos(absAngle)) / Math.sin(absAngle)
  return Math.abs(shift)
}

function movePointAlongDirectionXY(point: Vec2, unitVec: Vec2, distance: number) {
  const x = point.x + distance * unitVec.x
  const y = point.y + distance * unitVec.y
  return { x, y }
}

function getUnitVectorXY(pointOne: Vec2, pointTwo: Vec2) {
  const length = ((pointTwo.x - pointOne.x) ** 2 + (pointTwo.y - pointOne.y) ** 2) ** 0.5
  const x = (pointTwo.x - pointOne.x) / length
  const y = (pointTwo.y - pointOne.y) / length
  return { x, y }
}

function getAngleXY(p0: Vec2, p1: Vec2, p2: Vec2) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function getBands({
  width,
  corridorWidth,
  corridorAlignment,
}: {
  width: number
  corridorWidth: number
  corridorAlignment: Alignment
}) {
  if (corridorAlignment === "left") {
    const ts = [width, width - corridorWidth, 0]
    const types = ["CORRIDOR", "LIVING_UNIT"]
    return { ts, types }
  }
  if (corridorAlignment === "right") {
    const ts = [width, corridorWidth, 0]
    const types = ["LIVING_UNIT", "CORRIDOR"]
    return { ts, types }
  }
  const ts = [width, 0.5 * width + 0.5 * corridorWidth, 0.5 * width - 0.5 * corridorWidth, 0]
  const types = ["LIVING_UNIT", "CORRIDOR", "LIVING_UNIT"]
  return { ts, types }
}

export function getCirculationCorner({
  cornerVertex,
  prevVertex,
  nextVertex,
  width,
  corridorWidth,
  corridorAlignment,
  startLeg,
  endLeg,
}: {
  cornerVertex: Vec2
  prevVertex: Vec2
  nextVertex: Vec2
  width: number
  corridorWidth: number
  corridorAlignment: Alignment
  startLeg: number
  endLeg: number
}) {
  const angle = getAngleXY(prevVertex, cornerVertex, nextVertex)
  const blockDist = getBlockDistanceForSimpleCorner(width, angle)

  const unitVecOne = getUnitVectorXY(prevVertex, cornerVertex)
  const normalVecOne = { x: -unitVecOne.y, y: unitVecOne.x }
  const unitVecTwo = getUnitVectorXY(cornerVertex, nextVertex)
  const c0 = movePointAlongDirectionXY(cornerVertex, unitVecOne, -(blockDist + startLeg))

  const bands = getBands({ width, corridorWidth, corridorAlignment })

  if (angle < 0) {
    const lineBands = bands.ts.map((t) => {
      const lineBand = []
      let p = movePointAlongDirectionXY(c0, normalVecOne, t - 0.5 * width)
      lineBand.push(p)
      if (startLeg > 0 || t > 0) {
        p = movePointAlongDirectionXY(p, unitVecOne, ((2 * blockDist) / width) * t + startLeg)
        lineBand.push(p)
      }
      if (endLeg > 0 || t > 0) {
        p = movePointAlongDirectionXY(p, unitVecTwo, ((2 * blockDist) / width) * t + endLeg)
        lineBand.push(p)
      }
      return lineBand
    })
    return bands.types.map((type, i) => {
      const l0 = lineBands[i]
      const l1 = lineBands[i + 1]
      const polygon = [...l1, ...[...l0].reverse(), l1[0]]
      return { polygon, holes: [], type }
    })
  } else {
    const lineBands = bands.ts.map((t) => {
      const lineBand = []
      let p = movePointAlongDirectionXY(c0, normalVecOne, t - 0.5 * width)
      lineBand.push(p)
      if (startLeg > 0 || width > t) {
        p = movePointAlongDirectionXY(p, unitVecOne, ((2 * blockDist) / width) * (width - t) + startLeg)
        lineBand.push(p)
      }
      if (endLeg > 0 || width > t) {
        p = movePointAlongDirectionXY(p, unitVecTwo, ((2 * blockDist) / width) * (width - t) + endLeg)
        lineBand.push(p)
      }
      return lineBand
    })

    return bands.types.map((type, i) => {
      const l0 = lineBands[i]
      const l1 = lineBands[i + 1]
      const polygon = [...l1, ...[...l0].reverse(), l1[0]]
      return { polygon, holes: [], type }
    })
  }
}
