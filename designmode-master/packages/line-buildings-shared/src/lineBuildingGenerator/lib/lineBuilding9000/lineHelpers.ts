import type { Vec2 } from "./graphLineHelpers.js"

function getAngle(p0: Vec2, p1: Vec2, p2: Vec2) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

export function getLineAngles(line: [Vec2, Vec2], closedLine = false) {
  const angles = []
  const n = line.length
  for (let i = 0; i < line.length; i++) {
    if ((i === 0 || i === line.length - 1) && !closedLine) {
      angles.push(0)
      continue
    }
    const p0 = line[(i - 1 + n) % n]
    const p1 = line[i % n]
    const p2 = line[(i + 1) % n]
    const angle = getAngle(p0, p1, p2)
    angles.push(angle)
  }
  return angles
}

function getLineLength(pointOne: Vec2, pointTwo: Vec2) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

export function getLineSegmentLengths(line: [Vec2, Vec2], closedLine = false) {
  const lineSegmentLengths = []
  const n = line.length
  for (let i = 0; i < line.length; i++) {
    if (i === line.length - 1 && !closedLine) break
    const pointOne = line[i]
    const pointTwo = line[(i + 1) % n]
    const lineSegmentLength = getLineLength(pointOne, pointTwo)
    lineSegmentLengths.push(lineSegmentLength)
  }
  return lineSegmentLengths
}
