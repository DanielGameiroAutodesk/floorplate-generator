import { splitLineInNonCollapsedLines } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/blockingDistance"
import { bufferLine } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/bufferLine"
import { graphToLineData } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers"
import type { Graph } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import type { LineSegment, Point3D } from "./selectionOutlineTypes"
import { getSelectionOutlineRoofLines } from "./selectionRoofLine"

type Parameters = {
  width: number
  lineAlignment: "center" | "left" | "right"
  sectionProps: any
  sections: any
  minSubBuildingLength: number
  numberOfFloors: number
  floorHeight: number
  sectionToggle: boolean
}

////
//
////

function getSelectionOutlineWithSections({
  line,
  closedLine,
  parameters,
  lowestZ,
}: {
  line: any
  closedLine: boolean
  parameters: Parameters
  lowestZ: number
}) {
  const outlineLines: LineSegment[] = []

  const { width } = parameters

  const leftLine = bufferLine(line, 0.5 * width, closedLine)
  const rightLine = bufferLine(line, -0.5 * width, closedLine)

  for (let i = 0; i < leftLine.length - 1; i++) {
    const { x: x0, y: y0 } = leftLine[i]
    const { x: x1, y: y1 } = leftLine[i + 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])
  }

  for (let i = 0; i < rightLine.length - 1; i++) {
    const { x: x0, y: y0 } = rightLine[i]
    const { x: x1, y: y1 } = rightLine[i + 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])
  }

  if (closedLine) {
    const n = rightLine.length
    const { x: x0, y: y0 } = rightLine[0]
    const { x: x1, y: y1 } = rightLine[n - 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])
  }

  if (closedLine) {
    const n = leftLine.length
    const { x: x0, y: y0 } = leftLine[0]
    const { x: x1, y: y1 } = leftLine[n - 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])
  }

  if (!closedLine) {
    const { x: x0, y: y0 } = rightLine[0]
    const { x: x1, y: y1 } = leftLine[0]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])
  }

  if (!closedLine) {
    const n = rightLine.length
    const m = leftLine.length
    const { x: x0, y: y0 } = rightLine[n - 1]
    const { x: x1, y: y1 } = leftLine[m - 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])
  }

  const roofLines = getSelectionOutlineRoofLines({ line, closedLine, parameters, lowestZ })

  outlineLines.push(...roofLines)

  return outlineLines
}

///
///
///

function getSelectionOutlineWithoutSections({
  line,
  closedLine,
  parameters,
  lowestZ,
}: {
  line: any
  closedLine: boolean
  parameters: Parameters
  lowestZ: number
}) {
  const outlineLines: LineSegment[] = []

  const { width, floorHeight, numberOfFloors } = parameters

  const height = floorHeight * numberOfFloors
  const leftLine = bufferLine(line, 0.5 * width, closedLine)
  const rightLine = bufferLine(line, -0.5 * width, closedLine)

  for (let i = 0; i < leftLine.length - 1; i++) {
    const { x: x0, y: y0 } = leftLine[i]
    const { x: x1, y: y1 } = leftLine[i + 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])

    const p2: Point3D = [x0, y0, lowestZ + height]
    const p3: Point3D = [x1, y1, lowestZ + height]
    outlineLines.push([p2, p3])
  }

  for (let i = 0; i < rightLine.length - 1; i++) {
    const { x: x0, y: y0 } = rightLine[i]
    const { x: x1, y: y1 } = rightLine[i + 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])

    const p2: Point3D = [x0, y0, lowestZ + height]
    const p3: Point3D = [x1, y1, lowestZ + height]
    outlineLines.push([p2, p3])
  }

  if (closedLine) {
    const n = rightLine.length
    const { x: x0, y: y0 } = rightLine[0]
    const { x: x1, y: y1 } = rightLine[n - 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])

    const p2: Point3D = [x0, y0, lowestZ + height]
    const p3: Point3D = [x1, y1, lowestZ + height]
    outlineLines.push([p2, p3])
  }

  if (closedLine) {
    const n = leftLine.length
    const { x: x0, y: y0 } = leftLine[0]
    const { x: x1, y: y1 } = leftLine[n - 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])

    const p2: Point3D = [x0, y0, lowestZ + height]
    const p3: Point3D = [x1, y1, lowestZ + height]
    outlineLines.push([p2, p3])
  }

  if (!closedLine) {
    const { x: x0, y: y0 } = rightLine[0]
    const { x: x1, y: y1 } = leftLine[0]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])

    const p2: Point3D = [x1, y1, lowestZ + height]
    const p3: Point3D = [x0, y0, lowestZ + height]
    outlineLines.push([p1, p2])
    outlineLines.push([p0, p3])
    outlineLines.push([p2, p3])
  }

  if (!closedLine) {
    const n = rightLine.length
    const m = leftLine.length
    const { x: x0, y: y0 } = rightLine[n - 1]
    const { x: x1, y: y1 } = leftLine[m - 1]
    const p0: Point3D = [x0, y0, lowestZ]
    const p1: Point3D = [x1, y1, lowestZ]
    outlineLines.push([p0, p1])

    const p2: Point3D = [x1, y1, lowestZ + height]
    const p3: Point3D = [x0, y0, lowestZ + height]

    outlineLines.push([p1, p2])
    outlineLines.push([p0, p3])
    outlineLines.push([p2, p3])
  }

  return outlineLines
}

function getSelectionOutline({
  line,
  closedLine,
  parameters,
  lowestZ,
}: {
  line: any
  closedLine: boolean
  parameters: Parameters
  lowestZ: number
}) {
  const { sectionToggle } = parameters
  if (!sectionToggle) return getSelectionOutlineWithoutSections({ line, closedLine, parameters, lowestZ })

  return getSelectionOutlineWithSections({ line, closedLine, parameters, lowestZ })
}

export function getSelectionOutlineForLineBuilding({
  graph,
  parameters,
  lowestZ,
}: {
  graph: Graph
  parameters: Parameters
  lowestZ: number
}): Float32Array {
  const lineData = graphToLineData(graph)
  const { width } = parameters
  const splitLines = splitLineInNonCollapsedLines(lineData.line, width, lineData.closedLine)
  const selectionOutlineLines: LineSegment[] = splitLines.flatMap(({ line, closed }) => {
    return getSelectionOutline({ line, closedLine: closed, parameters, lowestZ })
  })

  const n = selectionOutlineLines.length
  const outlineGeometry = new Float32Array(n * 6)
  for (let i = 0; i < n; i += 1) {
    const [[x0, y0, z0], [x1, y1, z1]] = selectionOutlineLines[i]
    const shift = i * 6
    outlineGeometry[shift] = x0
    outlineGeometry[shift + 1] = y0
    outlineGeometry[shift + 2] = z0
    outlineGeometry[shift + 3] = x1
    outlineGeometry[shift + 4] = y1
    outlineGeometry[shift + 5] = z1
  }
  return outlineGeometry
}
