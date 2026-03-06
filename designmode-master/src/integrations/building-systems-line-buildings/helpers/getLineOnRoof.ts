import { Vector3 } from "three"
import type { Graph, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import { getAngleXY, getBlockDistanceForSimpleCorner } from "@spacemakerai/line-buildings-shared/helpers/geoHelpers"
import { COLLAPSE_ANGLE_THRESHOLD } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/constants"

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

function getLineOnRoofWithoutSections(
  liveVertices: { x: number; y: number; id: string }[],
  graph: Graph,
  parameters: Parameters,
  lowestZ: number,
) {
  const linesOnRoof: any[] = []
  const elevation = lowestZ + parameters.floorHeight * parameters.numberOfFloors
  for (let edge of Object.values(graph.edges)) {
    const v0 = liveVertices.find((vertex) => vertex.id === edge.start) as {
      x: number
      y: number
      id: string
    }
    const v1 = liveVertices.find((vertex) => vertex.id === edge.end) as { x: number; y: number; id: string }
    const edgeLine = [v0, v1].map((point) => {
      return new Vector3(point.x, point.y, elevation)
    })
    linesOnRoof.push(edgeLine)
  }
  return linesOnRoof
}

export function getLineOnRoof(
  graph: Graph,
  parameters: Parameters,
  lowestZ: number,
  liveVertices: { x: number; y: number; id: string }[],
): [Vector3, Vector3][] {
  const { width, lineAlignment, floorHeight, sectionToggle, sectionProps, sections } = parameters
  if (!sectionToggle) return getLineOnRoofWithoutSections(liveVertices, graph, parameters, lowestZ)

  const linesOnRoof: any[] = []

  for (let edge of Object.values(graph.edges)) {
    let startVertex = liveVertices.find((vertex) => vertex.id === edge.start) as GraphVertex
    let endVertex = liveVertices.find((vertex) => vertex.id === edge.end) as GraphVertex
    let startCornerBlock = 0
    let startCornerLeg = 0
    let endCornerBlock = 0
    let endCornerLeg = 0

    const prevEdge = Object.values(graph.edges).find((edge) => edge.end === startVertex.id)
    const nextEdge = Object.values(graph.edges).find((edge) => edge.start === endVertex.id)

    const startCornerSectionID = startVertex.id + "::" + 0
    const haveStartCorner = !!sections?.[startCornerSectionID]
    if (prevEdge) {
      const prevVertex = liveVertices.find((vertex) => vertex.id === prevEdge.start) as GraphVertex
      startCornerBlock = getCornerBlockDist(prevVertex, startVertex, endVertex, width, lineAlignment)
      const cornerSectionId = startVertex.id + "::" + 0
      startCornerLeg = sectionProps[cornerSectionId]?.endLeg || 0
    }

    const endCornerSectionID = endVertex.id + "::" + 0
    const haveEndCorner = !!sections?.[endCornerSectionID]
    if (nextEdge) {
      const nextVertex = liveVertices.find((vertex) => vertex.id === nextEdge.end) as GraphVertex
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
    })
    linesOnRoof.push(...lineOnEdgeRoof)
  }
  return linesOnRoof
}
