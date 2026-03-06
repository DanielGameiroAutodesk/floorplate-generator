import { Vector3 } from "three"
import { toFeetIfImperial, toMetersIfImperial } from "src/lib/measurementSystem"
import { moveGraphToCenterLine } from "./lineAlignment"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import { getAngleXY, getBlockDistanceForSimpleCorner } from "@spacemakerai/line-buildings-shared/helpers/geoHelpers"
import { COLLAPSE_ANGLE_THRESHOLD } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/constants"
import {
  getDistBetweenPoints,
  getDistFromPointToLine,
  getUnitVectorXY,
} from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"
import type {
  EdgeSectionProp,
  SectionProps,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { Graph, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"

function pointPointDistanceXY(pointOne: { x: number; y: number }, pointTwo: { x: number; y: number }) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

function getCornerBlockDist(
  prevVertex: GraphVertex,
  cornerVertex: GraphVertex,
  nextVertex: GraphVertex,
  width: number,
) {
  const angle = getAngleXY(prevVertex, cornerVertex, nextVertex)
  if (Math.abs(angle) > COLLAPSE_ANGLE_THRESHOLD) return 0
  if (Math.abs(angle) < 1e-8) return 0
  return getBlockDistanceForSimpleCorner({ normalDist: 0.5 * width, angle })
}

function getEdge(edgeVertexID: string, graph: Graph, point: { x: number; y: number }) {
  const edge = graph.edges[edgeVertexID]
  if (edge) return edge
  const vertex = graph.vertices[edgeVertexID]
  if (!vertex) return undefined
  const edges = Object.values(graph.edges).filter((edge) => edge.end === vertex.id || edge.start === vertex.id)
  let minDistToEdge = Infinity
  let closestEdge
  for (let edge of edges) {
    const startVertex = graph.vertices[edge.start]
    const endVertex = graph.vertices[edge.end]
    const distToEdge = getDistFromPointToLine(startVertex, endVertex, point)
    if (distToEdge < minDistToEdge) {
      minDistToEdge = distToEdge
      closestEdge = edge
    }
  }
  return closestEdge
}

function getEdgeLength(edgeId: string, graph: Graph) {
  const edge = graph.edges[edgeId]
  const startVertex = graph.vertices[edge.start]
  const endVertex = graph.vertices[edge.end]
  return getDistBetweenPoints(startVertex, endVertex)
}

function getEdgeBlocks(edgeId: string, graph: Graph, width: number) {
  let startBlock = 0
  let endBlock = 0

  const edge = graph.edges[edgeId]
  const startVertex = graph.vertices[edge.start]
  const endVertex = graph.vertices[edge.end]
  const prevEdge = Object.values(graph.edges).find((edge) => edge.end === startVertex.id)
  const nextEdge = Object.values(graph.edges).find((edge) => edge.start === endVertex.id)

  if (prevEdge) {
    const prevVertex = Object.values(graph.vertices).find((vertex) => vertex.id === prevEdge.start) as GraphVertex
    startBlock = getCornerBlockDist(prevVertex, startVertex, endVertex, width)
  }

  if (nextEdge) {
    const nextVertex = Object.values(graph.vertices).find((vertex) => vertex.id === nextEdge.end) as GraphVertex
    endBlock = getCornerBlockDist(startVertex, endVertex, nextVertex, width)
  }

  return { startBlock, endBlock }
}

type Point = { x: number; y: number }

function findClosetSectionCut(
  startPoint: Point,
  endPoint: Point,
  point: Vector3,
  sectionLengths: number[],
  startBlock: number,
  starCornerLeg: number,
  endBlock: number,
  endCornerLeg: number,
  hasStartCorner: boolean,
  hasEndCorner: boolean,
): { cutIndex: number; side: "before" | "after"; cutDistance: number } | undefined {
  const unit = getUnitVectorXY(startPoint, endPoint)
  const edgeLength = pointPointDistanceXY(startPoint, endPoint)
  const s = (point.x - startPoint.x) * unit.x + (point.y - startPoint.y) * unit.y

  let cutDist = startBlock + starCornerLeg
  const sectionCuts = []
  const n = sectionLengths.length
  if (hasStartCorner) sectionCuts.push(cutDist)
  for (let i = 0; i < n - 1; i++) {
    cutDist += sectionLengths[i]
    sectionCuts.push(cutDist)
  }

  if (hasEndCorner && sectionLengths.length > 0) sectionCuts.push(edgeLength - endBlock - endCornerLeg)

  let minDist = Infinity
  let closestCutIndex
  for (let i = 0; i < sectionCuts.length; i++) {
    const cut = sectionCuts[i]
    const dist = Math.abs(cut - s)
    if (dist < minDist) {
      closestCutIndex = i
      minDist = dist
    }
  }
  if (closestCutIndex === undefined) return undefined

  const SnapDistPixelsSpace = 5
  const SnapDist = pixelsToMetersAtPositionStatic(SnapDistPixelsSpace, new Vector3(point.x, point.y, point.z))

  if (minDist > SnapDist) return undefined
  const cut = sectionCuts[closestCutIndex]

  let cutIndex = closestCutIndex
  if (!hasStartCorner) cutIndex += 1

  if (cut > s) {
    return { cutIndex, side: "before", cutDistance: cut }
  }
  return { cutIndex, side: "after", cutDistance: cut }
}

function getNumberOfEdgeSections(edgeID: string, sectionProps: SectionProps) {
  return Object.keys(sectionProps).filter((sectionId) => {
    return sectionId.split("::")[0] === edgeID
  }).length
}

function getSectionLengths(graph: Graph, edgeID: string, sectionProps: SectionProps) {
  const numberOfEdgeSections = getNumberOfEdgeSections(edgeID, sectionProps)
  const sectionLengths: number[] = []
  for (let i = 0; i < numberOfEdgeSections; i++) {
    const sectionId = edgeID + "::" + i
    const edgeSectionProp = sectionProps[sectionId] as EdgeSectionProp
    const sectionLength = edgeSectionProp.minSubBuildingLength
    sectionLengths.push(sectionLength)
  }
  return sectionLengths
}

function findAddSectionCut(startPoint: Point, endPoint: Point, point: Point): { cutDistance: number } {
  const unit = getUnitVectorXY(startPoint, endPoint)

  const s = (point.x - startPoint.x) * unit.x + (point.y - startPoint.y) * unit.y

  return { cutDistance: s }
}

function getRoundedToClosesUnit(length: number, imperialFlag: boolean) {
  if (!imperialFlag) {
    return Math.round(length)
  }
  return toMetersIfImperial(Math.round(toFeetIfImperial(length, imperialFlag)), imperialFlag)
}

/////
// Add section cut
/////

export type AddSectionCutData = {
  edgeId: string
  sectionType: "startCorner" | "edgeSection" | "endCorner"
  sectionId: string
  sectionIndex: number
  cutDistance: number
  beforeSectionLength: number
  afterSectionLength: number
  effectiveBeforeSectionLength: number
  effectiveAfterSectionLength: number
}

function getAddSectionCutDataEndCorner({
  edge,
  vertexId,
  centerGraph,
  hitPoint,
  width,
  sectionProps,
  imperialFlag,
}: any) {
  const edgeId = edge.id
  const startPoint = centerGraph.vertices[edge.start]
  const endPoint = centerGraph.vertices[edge.end]

  const { endBlock } = getEdgeBlocks(edgeId, centerGraph, width)
  const edgeLength = getEdgeLength(edgeId, centerGraph)

  const { endCornerLeg } = getHasCornerAndLegLengths(startPoint, endPoint, sectionProps)
  if (endCornerLeg === 0) return undefined

  const unit = getUnitVectorXY(startPoint, endPoint)
  const s = (hitPoint.x - startPoint.x) * unit.x + (hitPoint.y - startPoint.y) * unit.y

  let cutDistance
  if (s > edgeLength - endBlock + 1) return undefined
  if (s > edgeLength - endBlock - 1) {
    cutDistance = edgeLength - endBlock
  } else if (s < edgeLength - endBlock - endCornerLeg + 1) {
    cutDistance = edgeLength - endBlock - endCornerLeg
  } else {
    const localUnit = toFeetIfImperial(s - (edgeLength - endBlock - endCornerLeg), imperialFlag)
    const roundedLocalUnit = Math.round(localUnit)
    const roundedSiUnit = toMetersIfImperial(roundedLocalUnit, imperialFlag)
    cutDistance = roundedSiUnit + (edgeLength - endBlock - endCornerLeg)
  }

  const beforeSectionLength = cutDistance - (edgeLength - endBlock - endCornerLeg)
  const afterSectionLength = edgeLength - endBlock - cutDistance

  const sectionId = vertexId + "::" + 0
  const sectionCutData: AddSectionCutData = {
    edgeId,
    sectionType: "endCorner",
    sectionId,
    sectionIndex: 0,
    cutDistance: cutDistance,
    beforeSectionLength: beforeSectionLength,
    afterSectionLength: afterSectionLength,
    effectiveBeforeSectionLength: beforeSectionLength,
    effectiveAfterSectionLength: afterSectionLength,
  }
  return sectionCutData
}

function getAddSectionCutDataStartCorner({
  edge,
  vertexId,
  centerGraph,
  hitPoint,
  width,
  sectionProps,
  imperialFlag,
}: any): AddSectionCutData | undefined {
  const edgeId = edge.id
  const startPoint = centerGraph.vertices[edge.start]
  const endPoint = centerGraph.vertices[edge.end]

  const { startBlock } = getEdgeBlocks(edgeId, centerGraph, width)

  const { starCornerLeg } = getHasCornerAndLegLengths(startPoint, endPoint, sectionProps)

  const unit = getUnitVectorXY(startPoint, endPoint)
  const s = (hitPoint.x - startPoint.x) * unit.x + (hitPoint.y - startPoint.y) * unit.y

  let cutDistance
  if (s < startBlock - 1) return undefined
  if (s > startBlock + starCornerLeg - 1) {
    cutDistance = startBlock + starCornerLeg
  } else if (s < startBlock + 1) {
    cutDistance = startBlock
  } else {
    const localUnit = toFeetIfImperial(s - startBlock, imperialFlag)
    const roundedLocalUnit = Math.round(localUnit)
    const roundedSiUnit = toMetersIfImperial(roundedLocalUnit, imperialFlag)
    cutDistance = roundedSiUnit + startBlock
  }

  const beforeSectionLength = cutDistance - startBlock
  const afterSectionLength = startBlock + starCornerLeg - cutDistance

  const sectionId = vertexId + "::" + 0
  return {
    edgeId,
    sectionType: "startCorner",
    sectionId,
    sectionIndex: 0,
    cutDistance: cutDistance,
    beforeSectionLength: beforeSectionLength,
    afterSectionLength: afterSectionLength,
    effectiveBeforeSectionLength: beforeSectionLength,
    effectiveAfterSectionLength: afterSectionLength,
  }
}

export function getAddSectionCutData(
  hitTargets: any,
  transSideGraph: GraphZ,
  sectionProps: SectionProps,
  floorHeight: number,
  width: number,
  lineAlignment: "left" | "right" | "center",
  imperialFlag: boolean,
): AddSectionCutData | undefined {
  const sectionId = hitTargets[0]?.object?.name
  const hitPoint = hitTargets[0]?.point
  if (!sectionId || !hitPoint) return undefined

  const lowestZ = Object.values(transSideGraph.vertices)[0].z
  const centerGraph = moveGraphToCenterLine(transSideGraph, { width, lineAlignment })

  const edgeVertexID = sectionId.split("::")[0]

  const edge = getEdge(edgeVertexID, centerGraph, hitPoint)
  if (edge === undefined) return undefined

  if (edge.start === edgeVertexID) {
    return getAddSectionCutDataStartCorner({ edge, vertexId: edgeVertexID, centerGraph, hitPoint, width, sectionProps })
  }
  if (edge.end === edgeVertexID) {
    return getAddSectionCutDataEndCorner({ edge, vertexId: edgeVertexID, centerGraph, hitPoint, width, sectionProps })
  }

  const edgeId = edge.id
  const sectionIndex = parseInt(sectionId.split("::")[1])
  const sectionProp = sectionProps[sectionId] as EdgeSectionProp
  const startVertex = centerGraph.vertices[edge.start]
  const endVertex = centerGraph.vertices[edge.end]
  const roofZ = lowestZ + floorHeight * sectionProp.numberOfFloors
  const sectionLength = sectionProp.minSubBuildingLength
  if (Math.abs(hitPoint.z - roofZ) > 1e-2) return undefined

  const { startBlock, endBlock } = getEdgeBlocks(edge.id, centerGraph, width)

  const { starCornerLeg, endCornerLeg } = getHasCornerAndLegLengths(startVertex, endVertex, sectionProps)

  const edgeLength = getEdgeLength(edgeId, centerGraph)
  let startOfSectionDist = startBlock + starCornerLeg
  for (let i = 0; i < sectionIndex; i++) {
    const sectionId = edgeId + "::" + i
    const edgeSectionProp = sectionProps[sectionId] as EdgeSectionProp
    startOfSectionDist += edgeSectionProp.minSubBuildingLength
  }
  const effectiveSectionLength = Math.min(sectionLength, edgeLength - endBlock - endCornerLeg - startOfSectionDist)
  const { cutDistance } = findAddSectionCut(startVertex, endVertex, hitPoint)

  let beforeSectionLength = cutDistance - startOfSectionDist
  if (beforeSectionLength < 1) beforeSectionLength = 0
  else if (beforeSectionLength > effectiveSectionLength - 1) beforeSectionLength = effectiveSectionLength
  else beforeSectionLength = getRoundedToClosesUnit(beforeSectionLength, imperialFlag)

  const afterSectionLength = sectionLength - beforeSectionLength
  const effectiveAfterSectionLength = effectiveSectionLength - beforeSectionLength
  const effectiveBeforeSectionLength = beforeSectionLength

  const snappedCutDistance = startOfSectionDist + beforeSectionLength

  return {
    edgeId,
    sectionType: "edgeSection",
    sectionId,
    sectionIndex,
    cutDistance: snappedCutDistance,
    beforeSectionLength,
    afterSectionLength,
    effectiveBeforeSectionLength,
    effectiveAfterSectionLength,
  }
}

export type HoveredSectionCut = {
  edgeId: string
  cutIndex: number
  cutDistance: number
  side: "before" | "after"
  roofZ: number
  startCornerCut: boolean
  endCornerCut: boolean
}

export function getHoveredSection(
  hitTargets: any,
  transSideGraph: GraphZ,
  sectionProps: SectionProps,
  floorHeight: number,
  width: number,
  lineAlignment: "left" | "right" | "center",
): HoveredSectionCut | undefined {
  const sectionId = hitTargets[0]?.object?.name
  const hitPoint = hitTargets[0]?.point
  if (!sectionId || !hitPoint) return undefined

  const lowestZ = Object.values(transSideGraph.vertices)[0].z
  const centerGraph = moveGraphToCenterLine(transSideGraph, { width, lineAlignment })

  const sectionProp = sectionProps[sectionId]
  const edgeVertexID = sectionId.split("::")[0]
  const edge = getEdge(edgeVertexID, centerGraph, hitPoint)
  if (!edge) return undefined

  const startVertex = centerGraph.vertices[edge.start]
  const endVertex = centerGraph.vertices[edge.end]
  const roofZ = lowestZ + floorHeight * sectionProp.numberOfFloors
  if (Math.abs(hitPoint.z - roofZ) > 1e-2) return undefined

  const { startBlock, endBlock } = getEdgeBlocks(edge.id, centerGraph, width)

  const startCornerSectionId = startVertex.id + "::" + 0
  const endCornerSectionId = endVertex.id + "::" + 0
  const hasStartCorner = !!sectionProps[startCornerSectionId]
  const hasEndCorner = !!sectionProps[endCornerSectionId]
  // @ts-expect-error: Not sure why this is not part of type.
  const starCornerLeg = sectionProps[startCornerSectionId]?.endLeg || 0
  // @ts-expect-error: Not sure why this is not part of type.
  const endCornerLeg = sectionProps[endCornerSectionId]?.startLeg || 0

  const sectionLengths = getSectionLengths(centerGraph, edge.id, sectionProps)
  if (sectionLengths.length === 0 && (!hasStartCorner || !hasEndCorner)) return undefined
  const cut = findClosetSectionCut(
    startVertex,
    endVertex,
    hitPoint,
    sectionLengths,
    startBlock,
    starCornerLeg,
    endBlock,
    endCornerLeg,
    hasStartCorner,
    hasEndCorner,
  )
  if (!cut) return undefined
  const startCornerCut = cut.cutIndex === 0
  const endCornerCut = cut.cutIndex === sectionLengths.length

  return {
    edgeId: edge.id,
    cutIndex: cut.cutIndex,
    side: cut.side,
    cutDistance: cut.cutDistance,
    roofZ: roofZ,
    startCornerCut,
    endCornerCut,
  }
}

/////
///
/////

type SnapSectionCutOnDragProps = {
  position: Vector3
  transSideGraph: GraphZ
  dragSectionCut: HoveredSectionCut
  parameters: { sectionProps: SectionProps; width: number; lineAlignment: "left" | "right" | "center" }
  imperialFlag: boolean
}

export type DragSectionCutData = {
  newSectionLengthBefore: number
  newSectionLengthAfter: number
  effectiveSectionLengthBefore: number
  effectiveSectionLengthAfter: number
  cutDistance: number
  totalTargetLength: number
  totalEffectiveLength: number
  fixedBeforeLength?: number | undefined
  fixedAfterLength?: number | undefined
  startCornerCut: boolean
  endCornerCut: boolean
}

function getSnappedCutDrag(
  s: number,
  sectionLengthBefore: number,
  sectionLengthAfter: number,
  cutDistance: number,
  edgeLength: number,
  startBlock: number,
  endBlock: number,
  side: "before" | "after",
  imperialFlag: boolean,
  starCornerLeg: number,
  endCornerLeg: number,
) {
  const ds = s - cutDistance

  const maxValue = Math.min(edgeLength - endBlock - endCornerLeg - cutDistance, sectionLengthAfter)
  if (ds > maxValue - 1) {
    return maxValue
  }
  if (ds < -sectionLengthBefore + 1) {
    return -sectionLengthBefore
  }

  if (imperialFlag) {
    return (
      toMetersIfImperial(Math.round(toFeetIfImperial(ds + sectionLengthBefore, imperialFlag)), imperialFlag) -
      sectionLengthBefore
    )
  }
  return Math.round(ds + sectionLengthBefore) - sectionLengthBefore
}

function getHasCornerAndLegLengths(startVertex: GraphVertex, endVertex: GraphVertex, sectionProps: SectionProps) {
  const startCornerSectionId = startVertex.id + "::" + 0
  const endCornerSectionId = endVertex.id + "::" + 0
  const hasStartCorner = !!sectionProps[startCornerSectionId]
  const hasEndCorner = !!sectionProps[endCornerSectionId]
  // @ts-expect-error: Not sure why this is not part of type.
  const starCornerLeg: number = sectionProps[startCornerSectionId]?.endLeg || 0
  // @ts-expect-error: Not sure why this is not part of type.
  const endCornerLeg: number = sectionProps[endCornerSectionId]?.startLeg || 0

  return { hasStartCorner, hasEndCorner, starCornerLeg, endCornerLeg }
}

function getSectionCutDragEndCorner({
  s,
  edgeId,
  edgeLength,
  starCornerLeg,
  startBlock,
  endBlock,
  sectionProps,
  imperialFlag,
}: any) {
  const numberOfEdgeSections = getNumberOfEdgeSections(edgeId, sectionProps)

  let sectionBeforeStart = startBlock + starCornerLeg
  for (let i = 0; i < numberOfEdgeSections - 1; i++) {
    const sectionId = edgeId + "::" + i
    const sectionProp = sectionProps[sectionId] as EdgeSectionProp
    sectionBeforeStart += sectionProp.minSubBuildingLength
  }

  const cappedSectionEnd = edgeLength - endBlock

  let updatedCutDistance
  if (s < sectionBeforeStart + 1) {
    updatedCutDistance = sectionBeforeStart
  } else if (s > cappedSectionEnd - 1) {
    updatedCutDistance = cappedSectionEnd
  } else {
    const localUnit = toFeetIfImperial(s - sectionBeforeStart, imperialFlag)
    const roundedLocalUnit = Math.round(localUnit)
    const roundedSiUnit = toMetersIfImperial(roundedLocalUnit, imperialFlag)
    updatedCutDistance = roundedSiUnit + sectionBeforeStart
  }

  const newSectionLengthBefore = updatedCutDistance - sectionBeforeStart
  const newSectionLengthAfter = cappedSectionEnd - updatedCutDistance
  const effectiveSectionLengthBefore = updatedCutDistance - sectionBeforeStart
  const effectiveSectionLengthAfter = cappedSectionEnd - updatedCutDistance
  const totalEffectiveLength = effectiveSectionLengthBefore + effectiveSectionLengthAfter
  const totalTargetLength = cappedSectionEnd - sectionBeforeStart

  return {
    newSectionLengthBefore,
    newSectionLengthAfter,
    effectiveSectionLengthBefore,
    effectiveSectionLengthAfter,
    totalEffectiveLength,
    totalTargetLength,
    cutDistance: updatedCutDistance,
    startCornerCut: false,
    endCornerCut: true,
  }
}

function getSectionCutDragStartCorner({
  s,
  edgeId,
  edgeLength,
  starCornerLeg,
  endCornerLeg,
  startBlock,
  endBlock,
  sectionProps,
  imperialFlag,
}: any) {
  let afterSectionId = edgeId + "::" + 0
  const sectionPropAfter = sectionProps[afterSectionId] as EdgeSectionProp
  const sectionLengthAfter = sectionPropAfter.minSubBuildingLength

  const targetSectionEnd = startBlock + starCornerLeg + sectionLengthAfter
  const cappedSectionEnd = edgeLength - endBlock - endCornerLeg

  const effectiveSectionEnd = Math.min(targetSectionEnd, cappedSectionEnd)

  let updatedCutDistance
  if (s < startBlock + 1) {
    updatedCutDistance = startBlock
  } else if (s > effectiveSectionEnd - 1) {
    updatedCutDistance = effectiveSectionEnd
  } else {
    const localUnit = toFeetIfImperial(s - startBlock, imperialFlag)
    const roundedLocalUnit = Math.round(localUnit)
    const roundedSiUnit = toMetersIfImperial(roundedLocalUnit, imperialFlag)
    updatedCutDistance = roundedSiUnit + startBlock
  }

  const newSectionLengthBefore = updatedCutDistance - startBlock
  const newSectionLengthAfter = targetSectionEnd - updatedCutDistance
  const effectiveSectionLengthBefore = newSectionLengthBefore
  const effectiveSectionLengthAfter = effectiveSectionEnd - updatedCutDistance
  const totalEffectiveLength = newSectionLengthBefore + effectiveSectionLengthAfter
  const totalTargetLength = starCornerLeg + sectionLengthAfter

  return {
    newSectionLengthBefore,
    newSectionLengthAfter,
    effectiveSectionLengthBefore,
    effectiveSectionLengthAfter,
    totalEffectiveLength,
    totalTargetLength,
    cutDistance: updatedCutDistance,
    startCornerCut: true,
    endCornerCut: false,
  }
}

function getSectionCutDragDoubleCorner({
  s,
  edgeLength,
  starCornerLeg,
  endCornerLeg,
  startBlock,
  endBlock,
  imperialFlag,
}: any) {
  let updatedCutDistance
  if (s < startBlock + 1) {
    updatedCutDistance = startBlock
  } else if (s > edgeLength - endBlock - 1) {
    updatedCutDistance = edgeLength - endBlock
  } else {
    const localUnit = toFeetIfImperial(s - startBlock, imperialFlag)
    const roundedLocalUnit = Math.round(localUnit)
    const roundedSiUnit = toMetersIfImperial(roundedLocalUnit, imperialFlag)
    updatedCutDistance = roundedSiUnit + startBlock
  }

  const newSectionLengthBefore = updatedCutDistance - startBlock
  const newSectionLengthAfter = edgeLength - endBlock - updatedCutDistance
  const effectiveSectionLengthBefore = newSectionLengthBefore
  const effectiveSectionLengthAfter = newSectionLengthAfter
  const totalEffectiveLength = starCornerLeg + endCornerLeg
  const totalTargetLength = starCornerLeg + endCornerLeg

  return {
    newSectionLengthBefore,
    newSectionLengthAfter,
    effectiveSectionLengthBefore,
    effectiveSectionLengthAfter,
    totalEffectiveLength,
    totalTargetLength,
    cutDistance: updatedCutDistance,
    startCornerCut: true,
    endCornerCut: true,
  }
}

export function getSnappedPositionOnSectionCutDrag({
  position,
  dragSectionCut,
  transSideGraph,
  parameters,
  imperialFlag,
}: SnapSectionCutOnDragProps): DragSectionCutData {
  const { sectionProps, width, lineAlignment } = parameters

  const centerGraph = moveGraphToCenterLine(transSideGraph, { width, lineAlignment })
  const { edgeId, cutDistance, cutIndex, side, startCornerCut, endCornerCut } = dragSectionCut
  const edgeLength = getEdgeLength(edgeId, centerGraph)
  const { startBlock, endBlock } = getEdgeBlocks(edgeId, centerGraph, width)

  const edge = centerGraph.edges[edgeId]
  const startVertex = centerGraph.vertices[edge.start]
  const endVertex = centerGraph.vertices[edge.end]
  const unit = getUnitVectorXY(startVertex, endVertex)
  const { starCornerLeg, endCornerLeg } = getHasCornerAndLegLengths(startVertex, endVertex, sectionProps)

  const s = (position.x - startVertex.x) * unit.x + (position.y - startVertex.y) * unit.y

  if (startCornerCut && endCornerCut) {
    return getSectionCutDragDoubleCorner({
      s,
      edgeLength,
      starCornerLeg,
      endCornerLeg,
      startBlock,
      endBlock,
      imperialFlag,
    })
  }
  if (startCornerCut) {
    return getSectionCutDragStartCorner({
      s,
      edgeId,
      edgeLength,
      starCornerLeg,
      endCornerLeg,
      startBlock,
      endBlock,
      sectionProps,
      imperialFlag,
    })
  }
  if (endCornerCut) {
    return getSectionCutDragEndCorner({
      s,
      edgeId,
      edgeLength,
      starCornerLeg,
      startBlock,
      endBlock,
      sectionProps,
      imperialFlag,
    })
  }

  let beforeSectionId = edgeId + "::" + (cutIndex - 1)
  const sectionPropBefore = sectionProps[beforeSectionId] as EdgeSectionProp
  const sectionLengthBefore = sectionPropBefore.minSubBuildingLength

  let afterSectionId = edgeId + "::" + cutIndex
  const sectionPropAfter = sectionProps[afterSectionId] as EdgeSectionProp
  const sectionLengthAfter = sectionPropAfter.minSubBuildingLength

  const cutDs = getSnappedCutDrag(
    s,
    sectionLengthBefore,
    sectionLengthAfter,
    cutDistance,
    edgeLength,
    startBlock,
    endBlock,
    side,
    imperialFlag,
    starCornerLeg,
    endCornerLeg,
  )
  const blockDistance = edgeLength - endBlock - endCornerLeg
  const newSectionLengthBefore = sectionLengthBefore + cutDs
  const newSectionLengthAfter = sectionLengthAfter - cutDs

  const updatedCutDistance = cutDistance + cutDs
  const effectiveSectionLengthAfter = Math.min(newSectionLengthAfter, blockDistance - updatedCutDistance)
  const totalEffectiveLength = newSectionLengthBefore + effectiveSectionLengthAfter
  const totalTargetLength = newSectionLengthBefore + newSectionLengthAfter
  const effectiveSectionLengthBefore = newSectionLengthBefore
  return {
    newSectionLengthBefore,
    newSectionLengthAfter,
    effectiveSectionLengthBefore,
    effectiveSectionLengthAfter,
    totalEffectiveLength,
    totalTargetLength,
    cutDistance: updatedCutDistance,
    startCornerCut,
    endCornerCut,
  }
}

////
// Update section Props after section cut Add
////

function getUpdatedSectionPropsAfterSectionAddStartCorner({
  addSectionCutData,
  sectionProps,
}: {
  sectionProps: SectionProps
  addSectionCutData: AddSectionCutData
}) {
  const { edgeId, beforeSectionLength, afterSectionLength } = addSectionCutData

  if (afterSectionLength === 0) return sectionProps
  const cornerSectionId = addSectionCutData.sectionId

  const updatedSectionProps: SectionProps = {}
  for (let sectionId of Object.keys(sectionProps)) {
    const sectionEdgeId = sectionId.split("::")[0]
    const sectionIndex = parseInt(sectionId.split("::")[1])
    if (sectionId !== cornerSectionId && sectionEdgeId !== edgeId) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
      continue
    }
    if (sectionEdgeId === edgeId) {
      const updatedSectionId = sectionEdgeId + "::" + (sectionIndex + 1)
      updatedSectionProps[updatedSectionId] = sectionProps[sectionId]
    }
    if (sectionId === cornerSectionId) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], endLeg: beforeSectionLength }
    }
  }
  const newSectionId = edgeId + "::" + 0
  updatedSectionProps[newSectionId] = {
    numberOfFloors: sectionProps[cornerSectionId].numberOfFloors,
    minSubBuildingLength: afterSectionLength,
    feature: sectionProps[cornerSectionId].feature,
  }
  return updatedSectionProps
}

function getUpdatedSectionPropsAfterSectionAddEndCorner({
  addSectionCutData,
  sectionProps,
}: {
  sectionProps: SectionProps
  addSectionCutData: AddSectionCutData
}) {
  const { edgeId, beforeSectionLength, afterSectionLength } = addSectionCutData
  if (beforeSectionLength === 0) return sectionProps
  const cornerSectionId = addSectionCutData.sectionId

  const numberOfEdgeSections = getNumberOfEdgeSections(edgeId, sectionProps)

  const updatedSectionProps: SectionProps = {}
  for (let sectionId of Object.keys(sectionProps)) {
    const sectionEdgeId = sectionId.split("::")[0]
    const sectionIndex = parseInt(sectionId.split("::")[1])
    if (sectionId !== cornerSectionId && sectionEdgeId !== edgeId) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
      continue
    }
    if (sectionEdgeId === edgeId && sectionIndex < numberOfEdgeSections - 1) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
      continue
    }
    if (sectionEdgeId === edgeId) {
      const sectionProp = sectionProps[sectionId] as EdgeSectionProp
      const minSubBuildingLength = sectionProp.minSubBuildingLength
      updatedSectionProps[sectionId] = { ...sectionProp, minSubBuildingLength }
    }
    if (sectionId === cornerSectionId) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], startLeg: afterSectionLength }
    }
  }

  const newSectionId = edgeId + "::" + numberOfEdgeSections
  updatedSectionProps[newSectionId] = {
    numberOfFloors: sectionProps[cornerSectionId].numberOfFloors,
    minSubBuildingLength: beforeSectionLength,
    feature: sectionProps[cornerSectionId].feature,
  }

  return updatedSectionProps
}

export function getUpdatedSectionPropsAfterSectionAdd({
  sectionProps,
  addSectionCutData,
}: {
  sectionProps: SectionProps
  addSectionCutData: AddSectionCutData | undefined
}) {
  if (addSectionCutData === undefined) return sectionProps

  const { edgeId, sectionIndex, beforeSectionLength, afterSectionLength, sectionType } = addSectionCutData

  if (sectionType === "startCorner") {
    return getUpdatedSectionPropsAfterSectionAddStartCorner({ addSectionCutData, sectionProps })
  }
  if (sectionType === "endCorner") {
    return getUpdatedSectionPropsAfterSectionAddEndCorner({ addSectionCutData, sectionProps })
  }

  if (beforeSectionLength === 0 || afterSectionLength === 0) return sectionProps

  const updatedSectionProps: SectionProps = {}
  for (let sectionId of Object.keys(sectionProps)) {
    if (sectionId.split("::")[0] !== edgeId) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
      continue
    }
    const index = parseInt(sectionId.split("::")[1])
    if (index < sectionIndex) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
    }
    if (index > sectionIndex) {
      const updatedSectionId = edgeId + "::" + (index + 1)
      updatedSectionProps[updatedSectionId] = sectionProps[sectionId]
    }
    if (index === sectionIndex) {
      const beforeSectionId = sectionId
      const afterSectionId = edgeId + "::" + (index + 1)
      updatedSectionProps[beforeSectionId] = { ...sectionProps[sectionId], minSubBuildingLength: beforeSectionLength }
      updatedSectionProps[afterSectionId] = { ...sectionProps[sectionId], minSubBuildingLength: afterSectionLength }
    }
  }
  return updatedSectionProps
}

////
// Update sectionProps after section Drag
////

function getUpdatedSectionPropsAfterSectionDragEndCorner({
  sectionProps,
  newSectionLengthBefore,
  newSectionLengthAfter,
  vertexTwoId,
  edgeId,
}: any) {
  const numberOfEdgeSections = getNumberOfEdgeSections(edgeId, sectionProps)
  const cornerOneSectionId = vertexTwoId + "::" + 0
  const edgeSectionId = edgeId + "::" + (numberOfEdgeSections - 1)

  const updatedSectionProps: SectionProps = {}
  for (let sectionId of Object.keys(sectionProps)) {
    if (sectionId === cornerOneSectionId) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], startLeg: newSectionLengthAfter }
      continue
    }
    if (sectionId === edgeSectionId) {
      if (newSectionLengthBefore > 0)
        updatedSectionProps[sectionId] = { ...sectionProps[sectionId], minSubBuildingLength: newSectionLengthBefore }
      continue
    }
    updatedSectionProps[sectionId] = sectionProps[sectionId]
  }
  return updatedSectionProps
}

function getUpdatedSectionPropsAfterSectionDragStartCorner({
  sectionProps,
  newSectionLengthBefore,
  newSectionLengthAfter,
  vertexOneId,
  edgeId,
}: any) {
  const cornerOneSectionId = vertexOneId + "::" + 0

  const updatedSectionProps: SectionProps = {}
  for (let sectionId of Object.keys(sectionProps)) {
    if (sectionId === cornerOneSectionId) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], endLeg: newSectionLengthBefore }
      continue
    }
    const sectionEdgeVertexId = sectionId.split("::")[0]
    const sectionIndex = parseInt(sectionId.split("::")[1])
    if (sectionEdgeVertexId !== edgeId) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
      continue
    }
    if (sectionIndex === 0 && newSectionLengthAfter > 0) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], minSubBuildingLength: newSectionLengthAfter }
    }
    if (sectionIndex > 0 && newSectionLengthAfter === 0) {
      const updatedSectionId = edgeId + "::" + (sectionIndex - 1)
      updatedSectionProps[updatedSectionId] = sectionProps[sectionId]
    } else if (sectionIndex > 0) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
    }
  }
  return updatedSectionProps
}

function getUpdatedSectionPropsAfterSectionDragDoubleCorner({
  sectionProps,
  newSectionLengthBefore,
  newSectionLengthAfter,
  vertexOneId,
  vertexTwoId,
}: any) {
  const cornerOneSectionId = vertexOneId + "::" + 0
  const cornerTwoSectionId = vertexTwoId + "::" + 0

  const updatedSectionProps: SectionProps = {}
  for (let sectionId of Object.keys(sectionProps)) {
    if (sectionId === cornerOneSectionId) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], endLeg: newSectionLengthBefore }
    } else if (sectionId === cornerTwoSectionId) {
      updatedSectionProps[sectionId] = { ...sectionProps[sectionId], startLeg: newSectionLengthAfter }
    } else {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
    }
  }
  return updatedSectionProps
}

export function getUpdatedSectionPropsAfterSectionDrag({
  sectionProps,
  dragSectionCut,
  dragSectionCutData,
  graph,
}: {
  sectionProps: SectionProps
  dragSectionCut: HoveredSectionCut
  dragSectionCutData: DragSectionCutData | undefined
  graph: Graph
}): SectionProps {
  if (dragSectionCutData === undefined) return sectionProps
  const { edgeId, cutIndex, startCornerCut, endCornerCut } = dragSectionCut
  let newSectionLengthAfter = dragSectionCutData.newSectionLengthAfter
  let newSectionLengthBefore = dragSectionCutData.newSectionLengthBefore

  if (dragSectionCutData.fixedBeforeLength !== undefined) {
    newSectionLengthBefore = dragSectionCutData.fixedBeforeLength
    newSectionLengthAfter = dragSectionCutData.totalTargetLength - dragSectionCutData.fixedBeforeLength
  } else if (dragSectionCutData.fixedAfterLength !== undefined) {
    newSectionLengthAfter =
      dragSectionCutData.fixedAfterLength +
      (dragSectionCutData.totalTargetLength - dragSectionCutData.totalEffectiveLength)
    newSectionLengthBefore = dragSectionCutData.totalEffectiveLength - dragSectionCutData.fixedAfterLength
  }

  const edge = graph.edges[edgeId]
  const vertexOneId = edge.start
  const vertexTwoId = edge.end

  if (startCornerCut && endCornerCut) {
    return getUpdatedSectionPropsAfterSectionDragDoubleCorner({
      sectionProps,
      newSectionLengthBefore,
      newSectionLengthAfter,
      vertexOneId,
      vertexTwoId,
    })
  }
  if (startCornerCut) {
    return getUpdatedSectionPropsAfterSectionDragStartCorner({
      sectionProps,
      newSectionLengthBefore,
      newSectionLengthAfter,
      vertexOneId,
      edgeId,
    })
  }
  if (endCornerCut) {
    return getUpdatedSectionPropsAfterSectionDragEndCorner({
      sectionProps,
      newSectionLengthBefore,
      newSectionLengthAfter,
      vertexTwoId,
      edgeId,
    })
  }

  const sectionIdBefore = edgeId + "::" + (cutIndex - 1)
  const sectionIdAfter = edgeId + "::" + cutIndex

  const updatedSectionPropBefore: EdgeSectionProp = {
    ...sectionProps[sectionIdBefore],
    minSubBuildingLength: newSectionLengthBefore,
  }
  const updatedSectionPropAfter: EdgeSectionProp = {
    ...sectionProps[sectionIdAfter],
    minSubBuildingLength: newSectionLengthAfter,
  }

  const updatedSectionProps: SectionProps = {}
  let counter = 0
  for (let sectionId of Object.keys(sectionProps)) {
    if (sectionId.split("::")[0] !== edgeId) {
      updatedSectionProps[sectionId] = sectionProps[sectionId]
      continue
    }
    counter += 1
  }

  let sectionIndex = 0
  for (let i = 0; i < counter; i++) {
    const oldSectionId = edgeId + "::" + i
    const updatedSectionId = edgeId + "::" + sectionIndex
    if (cutIndex === i + 1) {
      if (newSectionLengthBefore === 0) continue
      updatedSectionProps[updatedSectionId] = updatedSectionPropBefore
    } else if (cutIndex === i) {
      if (newSectionLengthAfter === 0) continue
      updatedSectionProps[updatedSectionId] = updatedSectionPropAfter
    } else {
      updatedSectionProps[updatedSectionId] = sectionProps[oldSectionId]
    }
    sectionIndex += 1
  }

  return updatedSectionProps
}
