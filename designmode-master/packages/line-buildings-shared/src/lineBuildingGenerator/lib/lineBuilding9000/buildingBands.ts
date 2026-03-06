import type { LineXY } from "../../../selectionOutline/selectionOutlineTypes.js"
import { getCCWPolygon, getCWPolygon, isClockwise } from "./polygonHelpers.js"

export type FootPrint = {
  polygon: LineXY
  holes: LineXY[]
}

export function getFootPrint(leftLine: LineXY, rightLine: LineXY, closedLine: boolean): FootPrint {
  if (leftLine.length === 0 && rightLine.length === 0) return { polygon: [], holes: [] }
  if (closedLine) {
    const clockWiseLoop = isClockwise(leftLine)
    let polygon = clockWiseLoop ? getCCWPolygon(leftLine) : getCCWPolygon(rightLine)
    let hole = clockWiseLoop ? getCWPolygon(rightLine) : getCWPolygon(leftLine)

    const closedPolygon = [...polygon, polygon[0]]
    const closedHole = [...hole, hole[0]]
    return { polygon: closedPolygon, holes: [closedHole] }
  }

  const polygon = getCCWPolygon([...leftLine, ...[...rightLine].reverse()])
  const closedPolygon = [...polygon, polygon[0]]
  return { polygon: closedPolygon, holes: [] }
}
