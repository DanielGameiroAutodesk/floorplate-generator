import { getAngle, getNormVector, linesIntersectionPoint } from "./helpers.js"
import { lineSegmentsIntersect } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

const NPD = 1e-6

function getBaseLine(_start, _end, width) {
  const vec = getNormVector(_start, _end)
  const normal = [vec[1], -vec[0]]
  const start = [_start[0] - (normal[0] * width) / 2, _start[1] - (normal[1] * width) / 2]
  const end = [_end[0] - (normal[0] * width) / 2, _end[1] - (normal[1] * width) / 2]
  return { start, end, normal }
}

export function getOuterWalls(leftNeighbours, _start, _end, rightNeighbours, width) {
  let outerWalls = []
  if (leftNeighbours.length === 1) {
    const other = leftNeighbours[0]
    const neighbourPoint = other[0]
    const angle = getAngle(_end, _start, neighbourPoint)
    if (Math.abs(angle) > Math.PI - NPD) {
      const { start, normal } = getBaseLine(_start, _end, width)
      outerWalls.push([start, [start[0] + normal[0] * width, start[1] + normal[1] * width]])
    } else if (Math.abs(angle) > Math.PI * (2 / 3)) {
      const neighbourWidth = other[1].width
      const { start, end } = getBaseLine(_start, _end, width)
      const { start: start2, end: end2 } = getBaseLine(_end, _start, width)

      if (Math.max(width, neighbourWidth) * Math.cos(Math.abs(angle) - Math.PI) > Math.min(width, neighbourWidth)) {
        if (width > neighbourWidth) {
          const { start: otherStart, end: otherEnd } = getBaseLine(_start, neighbourPoint, neighbourWidth)
          const { start: otherStart2, end: otherEnd2 } = getBaseLine(neighbourPoint, _start, neighbourWidth)
          const facadePoint1 = linesIntersectionPoint(otherStart2, otherEnd2, start, end2)
          const facadePoint2 = linesIntersectionPoint(otherStart, otherEnd, start, end2)
          outerWalls.push([start, facadePoint1, facadePoint2, end2])
        } else {
          const { start: otherStart } = getBaseLine(_start, neighbourPoint, neighbourWidth)
          const { end: otherEnd2 } = getBaseLine(neighbourPoint, _start, neighbourWidth)
          outerWalls.push([
            linesIntersectionPoint(start, end, otherStart, otherEnd2),
            linesIntersectionPoint(start2, end2, otherStart, otherEnd2),
          ])
        }
      } else {
        const { start: otherStart, end: otherEnd } = getBaseLine(_start, neighbourPoint, neighbourWidth)
        const { start: otherStart2, end: otherEnd2 } = getBaseLine(neighbourPoint, _start, neighbourWidth)
        const intersection1 = linesIntersectionPoint(start, end, otherStart2, otherEnd2)
        const intersection2 = linesIntersectionPoint(start2, end2, otherStart, otherEnd)
        outerWalls.push([intersection1, intersection2])
      }
    } else {
      const { start, normal } = getBaseLine(_start, _end, width)
      outerWalls.push([start, [start[0] + normal[0] * width, start[1] + normal[1] * width]])
    }
  } else {
    const { start, normal } = getBaseLine(_start, _end, width)
    outerWalls.push([start, [start[0] + normal[0] * width, start[1] + normal[1] * width]])
  }

  if (rightNeighbours.length === 1) {
    const other = rightNeighbours[0]
    const neighbourPoint = other[0]
    const angle = getAngle(_start, _end, neighbourPoint)
    if (Math.abs(angle) > Math.PI - NPD) {
      const { end, normal } = getBaseLine(_start, _end, width)
      outerWalls.push([end, [end[0] + normal[0] * width, end[1] + normal[1] * width]])
    } else if (Math.abs(angle) > Math.PI * (2 / 3)) {
      const neighbourWidth = other[1].width
      const { start, end } = getBaseLine(_start, _end, width)
      const { start: start2, end: end2 } = getBaseLine(_end, _start, width)

      if (Math.max(width, neighbourWidth) * Math.cos(Math.abs(angle) - Math.PI) > Math.min(width, neighbourWidth)) {
        if (width > neighbourWidth) {
          const { start: otherStart, end: otherEnd } = getBaseLine(_end, neighbourPoint, neighbourWidth)
          const { start: otherStart2, end: otherEnd2 } = getBaseLine(neighbourPoint, _end, neighbourWidth)
          const facadePoint1 = linesIntersectionPoint(otherStart, otherEnd, start2, end)
          const facadePoint2 = linesIntersectionPoint(otherStart2, otherEnd2, start2, end)
          outerWalls.push([end, facadePoint1, facadePoint2, start2])
        } else {
          const { start: otherStart } = getBaseLine(_end, neighbourPoint, width)
          const { end: otherEnd2 } = getBaseLine(neighbourPoint, _end, width)
          outerWalls.push([
            linesIntersectionPoint(start, end, otherStart, otherEnd2),
            linesIntersectionPoint(start2, end2, otherStart, otherEnd2),
          ])
        }
      } else {
        const { start: otherStart, end: otherEnd } = getBaseLine(_end, neighbourPoint, neighbourWidth)
        const { start: otherStart2, end: otherEnd2 } = getBaseLine(neighbourPoint, _end, neighbourWidth)
        const intersection1 = linesIntersectionPoint(start, end, otherStart, otherEnd)
        const intersection2 = linesIntersectionPoint(start2, end2, otherStart2, otherEnd2)
        outerWalls.push([intersection1, intersection2])
      }
    } else {
      const { end, normal } = getBaseLine(_start, _end, width)
      outerWalls.push([end, [end[0] + normal[0] * width, end[1] + normal[1] * width]])
    }
  } else {
    const { end, normal } = getBaseLine(_start, _end, width)
    outerWalls.push([end, [end[0] + normal[0] * width, end[1] + normal[1] * width]])
  }

  if (
    lineSegmentsIntersect(
      outerWalls[0][0],
      outerWalls[0][outerWalls[0].length - 1],
      outerWalls[1][0],
      outerWalls[1][outerWalls[1].length - 1],
      true,
    )
  ) {
    const { start, normal: normalStart } = getBaseLine(_start, _end, width)
    const { end, normal } = getBaseLine(_start, _end, width)
    outerWalls = [
      [start, [start[0] + normalStart[0] * width, start[1] + normalStart[1] * width]],
      [end, [end[0] + normal[0] * width, end[1] + normal[1] * width]],
    ]
  }
  return { startWall: outerWalls[0], endWall: outerWalls[1] }
}
