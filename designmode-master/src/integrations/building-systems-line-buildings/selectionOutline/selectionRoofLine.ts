import { getAngleXY } from "src/integrations/building-systems-line-buildings/FloatingInputBox/geoHelpers"
import { getBlockDistanceForSimpleCorner } from "@spacemakerai/line-buildings-shared/helpers/geoHelpers"
import { COLLAPSE_ANGLE_THRESHOLD } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/constants"
import { bufferLine } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/bufferLine"
import type { Graph, GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import type { LineSegment, LineXY } from "./selectionOutlineTypes"
import { Vector3 } from "three"

function getEdgeLength(startVertex: { x: number; y: number }, endVertex: { x: number; y: number }) {
  return ((startVertex.x - endVertex.x) ** 2 + (startVertex.y - endVertex.y) ** 2) ** 0.5
}

function getUnitVec(startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) {
  const length = getEdgeLength(startPoint, endPoint)
  const x = (endPoint.x - startPoint.x) / length
  const y = (endPoint.y - startPoint.y) / length
  return { x, y }
}

function addVecToPoint(point: { x: number; y: number }, unitVec: { x: number; y: number }, dist: number) {
  const x = point.x + unitVec.x * dist
  const y = point.y + unitVec.y * dist
  return { x, y }
}

const NPD = 1e-4

function getRoofLinesOnEdge({
  startVertex,
  endVertex,
  sectionProps,
  edge,
  lowestZ,
  startCornerBlock,
  endCornerBlock,
  haveStartCorner,
  haveEndCorner,
  floorHeight,
  startCornerLeg,
  endCornerLeg,
}: any) {
  const roofLines = []
  const lineLength = getEdgeLength(startVertex, endVertex)
  const unitVec = getUnitVec(startVertex, endVertex)
  let startDist = 0
  let prevPoint

  if (haveStartCorner) {
    const sectionID = startVertex.id + "::" + 0
    const props = sectionProps[sectionID] || {}
    const numberOfFloors = props.numberOfFloors
    const height = numberOfFloors * floorHeight + lowestZ
    const endDist = startCornerBlock + startCornerLeg
    const startPoint = addVecToPoint(startVertex, unitVec, startDist)
    const endPoint = addVecToPoint(startVertex, unitVec, endDist)
    const roofLine = [startPoint, endPoint].map((point) => {
      return new Vector3(point.x, point.y, height)
    })
    prevPoint = roofLine[1]
    roofLines.push(roofLine)

    startDist += startCornerBlock + startCornerLeg
  }

  for (let i = 0; i < 100; i++) {
    const sectionID = edge.id + "::" + i
    const props = sectionProps[sectionID]
    if (!props) break
    let sectionDist = props.minSubBuildingLength
    if (i === 0 && !haveStartCorner) sectionDist += startCornerBlock
    if (!haveEndCorner && startDist + sectionDist >= lineLength - endCornerBlock - NPD) {
      sectionDist += endCornerBlock
    }

    const numberOfFloors = props.numberOfFloors
    const height = numberOfFloors * floorHeight + lowestZ

    const endDist = haveEndCorner
      ? Math.min(lineLength - endCornerBlock - endCornerLeg, startDist + sectionDist)
      : Math.min(lineLength, startDist + sectionDist)

    const startPoint = addVecToPoint(startVertex, unitVec, startDist)
    const endPoint = addVecToPoint(startVertex, unitVec, endDist)

    const roofLine = [startPoint, endPoint].map((point) => {
      return new Vector3(point.x, point.y, height)
    })
    if (prevPoint) {
      const wallLine = [prevPoint, roofLine[0]]
      roofLines.push(wallLine)
    }

    prevPoint = roofLine[1]

    roofLines.push(roofLine)
    startDist += sectionDist
    if (startDist >= lineLength - endCornerBlock - endCornerLeg - NPD) break
  }

  if (haveEndCorner) {
    const sectionID = endVertex.id + "::" + 0
    const props = sectionProps[sectionID] || {}
    const height = props.numberOfFloors * floorHeight + lowestZ

    const startDist = lineLength - endCornerBlock - endCornerLeg
    const endDist = lineLength
    const startPoint = addVecToPoint(startVertex, unitVec, startDist)
    const endPoint = addVecToPoint(startVertex, unitVec, endDist)
    const roofLine = [startPoint, endPoint].map((point) => {
      return new Vector3(point.x, point.y, height)
    })
    if (prevPoint) {
      const wallLine = [prevPoint, roofLine[0]]
      roofLines.push(wallLine)
    }
    roofLines.push(roofLine)
  }

  return roofLines
}

function getCornerBlockDist(
  prevVertex: GraphVertex,
  cornerVertex: GraphVertex,
  nextVertex: GraphVertex,
  width: number,
  lineAlignment: string,
) {
  const angle = getAngleXY(prevVertex, cornerVertex, nextVertex)
  if (Math.abs(angle) > COLLAPSE_ANGLE_THRESHOLD) return 0
  // if (Math.abs(angle) < SPLIT_CORNER_THRESHOLD) return 0
  if (Math.abs(angle) < 1e-4) return 0
  if (lineAlignment === "left" && angle > 0) return 0
  if (lineAlignment === "right" && angle < 0) return 0

  if (lineAlignment === "right" || lineAlignment === "left") {
    return getBlockDistanceForSimpleCorner({ normalDist: width, angle })
  }

  return getBlockDistanceForSimpleCorner({ normalDist: 0.5 * width, angle })
}

function getLineSubGraph(
  line: LineXY,
  graph: Graph,
  closedLine: boolean,
  width: number,
): { subGraph: Graph; leftLine: GraphVertex[]; rightLine: GraphVertex[] } {
  const vertexIds = line.map(({ x, y }) => {
    for (let vertexId of Object.keys(graph.vertices)) {
      const vertex = graph.vertices[vertexId]
      const dist = (vertex.x - x) ** 2 + (vertex.y - y) ** 2
      if (dist === 0) return vertexId
    }
  })

  const vertices: Record<string, GraphVertex> = {}
  const edges: Record<string, GraphEdge> = {}

  for (let i = 0; i < vertexIds.length; i++) {
    const vertexId = vertexIds[i]
    if (vertexId) vertices[vertexId] = graph.vertices[vertexId]
    if (!closedLine && i === vertexIds.length - 1) continue

    const edge = Object.values(graph.edges).find((edge) => {
      return edge.start === vertexId
    })
    if (edge) edges[edge.id] = edge
  }

  const leftLine: GraphVertex[] = bufferLine(line, 0.5 * width, closedLine).map((point, i) => {
    const vertexID = vertexIds[i] as string
    return { x: point.x, y: point.y, id: vertexID }
  })
  const rightLine: GraphVertex[] = bufferLine(line, -0.5 * width, closedLine).map((point, i) => {
    const vertexID = vertexIds[i] as string
    return { x: point.x, y: point.y, id: vertexID }
  })

  return { subGraph: { vertices, edges }, leftLine, rightLine }
}

function getLeftOrRightRoofLines({
  parameters,
  subGraph,
  vertexLine,
  lineAlignment,
  lowestZ,
  closedLine,
}: {
  parameters: any
  subGraph: Graph
  vertexLine: GraphVertex[]
  lineAlignment: "left" | "right"
  lowestZ: number
  closedLine: boolean
}) {
  const { sections, width, sectionProps, floorHeight } = parameters

  const linesOnRoof: [Vector3, Vector3][] = []

  const n = closedLine ? vertexLine.length : vertexLine.length - 1
  for (let i = 0; i < n; i++) {
    let startVertex = vertexLine[i]
    let endVertex = vertexLine[(i + 1) % vertexLine.length]
    const edge = Object.values(subGraph.edges).find((edge) => {
      return edge.start === startVertex.id && edge.end === endVertex.id
    })
    let startCornerBlock = 0
    let startCornerLeg = 0
    let endCornerBlock = 0
    let endCornerLeg = 0

    const prevEdge = Object.values(subGraph.edges).find((edge) => edge.end === startVertex.id)
    const nextEdge = Object.values(subGraph.edges).find((edge) => edge.start === endVertex.id)

    const startCornerSectionID = startVertex.id + "::" + 0
    const haveStartCorner = !!sections?.[startCornerSectionID]

    const startCollapse = i === 0 && !closedLine
    if (prevEdge && !startCollapse) {
      const prevVertex = vertexLine.find((vertex) => vertex.id === prevEdge.start) as GraphVertex
      startCornerBlock = getCornerBlockDist(prevVertex, startVertex, endVertex, width, lineAlignment)
      const cornerSectionId = startVertex.id + "::" + 0
      startCornerLeg = sectionProps[cornerSectionId]?.endLeg || 0
    }

    const endCornerSectionID = endVertex.id + "::" + 0
    const haveEndCorner = !!sections?.[endCornerSectionID]

    const endCollapse = i === n - 1 && !closedLine
    if (nextEdge && !endCollapse) {
      const nextVertex = vertexLine.find((vertex) => vertex.id === nextEdge.end) as GraphVertex
      endCornerBlock = getCornerBlockDist(startVertex, endVertex, nextVertex, width, lineAlignment)

      const cornerSectionId = endVertex.id + "::" + 0
      endCornerLeg = sectionProps[cornerSectionId]?.startLeg || 0
    }

    const lineOnEdgeRoof = getRoofLinesOnEdge({
      startVertex,
      endVertex,
      sectionProps,
      edge,
      lowestZ,
      startCornerBlock,
      endCornerBlock,
      haveStartCorner,
      haveEndCorner,
      floorHeight,
      startCornerLeg,
      endCornerLeg,
    }) as [Vector3, Vector3][]
    linesOnRoof.push(...lineOnEdgeRoof)
  }
  return linesOnRoof
}

export function getSelectionOutlineRoofLines({
  line,
  closedLine,
  parameters,
  lowestZ,
}: {
  line: LineXY
  closedLine: boolean
  parameters: any
  lowestZ: number
}): LineSegment[] {
  const linesOnRoof: [Vector3, Vector3][] = []

  const { width } = parameters
  const { subGraph, leftLine, rightLine } = getLineSubGraph(line, parameters.graph, closedLine, width)

  const linesOnRoofLeft = getLeftOrRightRoofLines({
    parameters,
    subGraph,
    vertexLine: leftLine,
    lineAlignment: "left",
    lowestZ,
    closedLine,
  })

  const linesOnRoofRight = getLeftOrRightRoofLines({
    parameters,
    subGraph,
    vertexLine: rightLine,
    lineAlignment: "right",
    lowestZ,
    closedLine,
  })

  if (!closedLine) {
    const p3 = linesOnRoofLeft[0][0]
    const p2 = linesOnRoofRight[0][0]
    const p1 = new Vector3(p2.x, p2.y, lowestZ)
    const p0 = new Vector3(p3.x, p3.y, lowestZ)
    const linesOnStart: [Vector3, Vector3][] = [
      [p1, p2],
      [p2, p3],
      [p3, p0],
    ]
    linesOnRoof.push(...linesOnStart)
  }

  if (!closedLine) {
    const n = linesOnRoofLeft.length
    const m = linesOnRoofRight.length
    const p3 = linesOnRoofLeft[n - 1][1]
    const p2 = linesOnRoofRight[m - 1][1]
    const p1 = new Vector3(p2.x, p2.y, lowestZ)
    const p0 = new Vector3(p3.x, p3.y, lowestZ)
    const linesOnStart: [Vector3, Vector3][] = [
      [p1, p2],
      [p2, p3],
      [p3, p0],
    ]
    linesOnRoof.push(...linesOnStart)
  }

  linesOnRoof.push(...linesOnRoofLeft)
  linesOnRoof.push(...linesOnRoofRight)

  return linesOnRoof.map(([v0, v1]) => {
    return [
      [v0.x, v0.y, v0.z],
      [v1.x, v1.y, v1.z],
    ]
  })
}
