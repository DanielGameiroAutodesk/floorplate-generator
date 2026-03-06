import { Vector3 } from "three"
import type { SectionDistanceDict } from "./sectionDistances"
import { getCustomSectionDistanceDict } from "./sectionDistances"
import type { OtherBuildingDragSnapData } from "src/integrations/building-systems-line-buildings/dragToOtherBuilding"
import type { VertexDragInputData } from "src/integrations/building-systems-line-buildings/FloatingInputBox/VertexDragInputBox"
import {
  snapToShapeToolLines,
  snapToShapeToolLinesFixedAngle,
} from "src/integrations/building-systems-line-buildings/DrawNewLineBuilding/snapToShapeToolLines"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import type { CandidateLine } from "src/integrations/snapping/snappingEngine"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import type { Graph, GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import { getUnitNormalVectorXY, getUnitVectorXY } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"
import type { SectionProps } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"

export type DragData = {
  snappedPosition: Vector3
  dragVertexId: string
  snappedToVertexId?: string | undefined
  snappedToLines?: SnappingLine[]
}

const VertexSnappingDist = 30
const AngleSnappingDist = 10
const SectionSnappingDist = 10

type SnapToSectionsSimpleEdgeProps = {
  position: Vector3
  dragVertex: { x: number; y: number; z: number; id: string }
  transSideGraph: Graph
  sectionDistanceDict: SectionDistanceDict
}

function pointPointDistanceXY(pointOne: { x: number; y: number }, pointTwo: { x: number; y: number }) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}
function getSnapToOtherBuilding(
  position: Vector3,
  otherBuildingsSnapData: OtherBuildingDragSnapData,
  dragVertexType: DragVertexType,
) {
  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(VertexSnappingDist, position)
  if (dragVertexType === "midDrag") return undefined
  const snappingPoints = otherBuildingsSnapData.snappingPoints[dragVertexType]

  let minDist = Infinity
  let closestSnapPoint
  for (let snapPoint of snappingPoints) {
    const dist = Math.abs(pointPointDistanceXY(snapPoint.point, position))
    if (dist < Math.min(minDist, WeightedSnappingDist)) {
      minDist = dist
      closestSnapPoint = snapPoint
    }
  }

  if (closestSnapPoint) {
    return { snappedPosition: closestSnapPoint.point, otherBuildingSnapData: closestSnapPoint }
  }
  return undefined
}

function snapToSectionsSimpleEdge({
  dragVertex,
  position,
  transSideGraph,
  sectionDistanceDict,
}: SnapToSectionsSimpleEdgeProps) {
  const edges = Object.values(transSideGraph.edges)
  const edge = edges[0]
  const startVertex = transSideGraph.vertices[edge.start]
  const endVertex = transSideGraph.vertices[edge.end]
  const { sectionDistances, defaultDistance } = sectionDistanceDict[edge.id]

  const otherVertex = startVertex.id === dragVertex.id ? endVertex : startVertex

  const edgeLength = ((position.x - otherVertex.x) ** 2 + (position.y - otherVertex.y) ** 2) ** 0.5
  const unitVec = [(position.x - otherVertex.x) / edgeLength, (position.y - otherVertex.y) / edgeLength]

  let distToSection = 0
  for (let i = 0; i < 100; i++) {
    const sectionDist = sectionDistances[i] || defaultDistance
    if (edgeLength < distToSection + 0.5 * sectionDist) break
    distToSection += sectionDist
  }

  if (distToSection === 0) return { snappedPosition: position, snapped: false }

  const snappedPosition = new Vector3(
    otherVertex.x + unitVec[0] * distToSection,
    otherVertex.y + unitVec[1] * distToSection,
    position.z,
  )

  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(SectionSnappingDist, position)

  if (Math.abs(distToSection - edgeLength) < WeightedSnappingDist) {
    return { snappedPosition, snapped: true }
  }

  return { snappedPosition: position, snapped: false }
}

type SnapToNeighbourVertexProps = {
  dragVertex: { x: number; y: number; z: number; id: string }
  position: Vector3
  transSideGraph: GraphZ
  otherBuildingsSnapData: OtherBuildingDragSnapData
  dragVertexType: DragVertexType
}

function getFirstAndLastVertex(graph: Graph) {
  let firstVertex
  let lastVertex
  const edges = Object.values(graph.edges)
  for (let vertex of Object.values(graph.vertices)) {
    if (!edges.some((edge) => edge.start === vertex.id)) lastVertex = vertex
    if (!edges.some((edge) => edge.end === vertex.id)) firstVertex = vertex
  }
  return { firstVertex, lastVertex }
}

function snapToVertex({
  dragVertex,
  position,
  transSideGraph,
  otherBuildingsSnapData,
  dragVertexType,
}: SnapToNeighbourVertexProps) {
  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(VertexSnappingDist, position)
  const neighbours: { x: number; y: number; id: string }[] = []

  for (let edge of Object.values(transSideGraph.edges)) {
    if (edge.start === dragVertex?.id) neighbours.push(transSideGraph.vertices[edge.end])
    if (edge.end === dragVertex?.id) neighbours.push(transSideGraph.vertices[edge.start])
  }
  const { firstVertex, lastVertex } = getFirstAndLastVertex(transSideGraph)
  if (firstVertex?.id === dragVertex.id && lastVertex !== undefined) {
    neighbours.push(lastVertex)
  }
  if (lastVertex?.id === dragVertex.id && firstVertex !== undefined) {
    neighbours.push(firstVertex)
  }

  for (let vertex of neighbours) {
    const dist = ((position.x - vertex.x) ** 2 + (position.y - vertex.y) ** 2) ** 0.5
    if (dist < WeightedSnappingDist) {
      const snappedPosition = new Vector3(vertex.x, vertex.y)
      return { snappedPosition, dragVertexId: dragVertex.id, snappedToVertexId: vertex.id }
    }
  }

  const snapToOtherBuilding = getSnapToOtherBuilding(position, otherBuildingsSnapData, dragVertexType)
  if (snapToOtherBuilding) {
    return { ...snapToOtherBuilding, dragVertexId: dragVertex.id }
  }

  return undefined
}

function getAnglesSnapLineData(v0: GraphVertex, v1: GraphVertex, position: Vector3) {
  const lineLength = ((v1.x - v0.x) ** 2 + (v1.y - v0.y) ** 2) ** 0.5
  const unitVec = [(v1.x - v0.x) / lineLength, (v1.y - v0.y) / lineLength]
  const vec = [position.x - v0.x, position.y - v0.y]
  const distToLine = vec[0] * unitVec[0] + vec[1] * unitVec[1]

  const pointOnLine = new Vector3(
    position.x - distToLine * unitVec[0],
    position.y - distToLine * unitVec[1],
    position.z,
  )

  return {
    pointOnLine,
    distToLine: Math.abs(distToLine),
  }
}

type SnapToAngleLinesProps = {
  position: Vector3
  dragVertex: { x: number; y: number; z: number; id: string }
  transSideGraph: GraphZ
}

function snapToNeighbourAngle({ dragVertex, position, transSideGraph }: SnapToAngleLinesProps) {
  let prevEdge
  let nextEdge
  for (let edge of Object.values(transSideGraph.edges)) {
    if (edge.end === dragVertex.id) prevEdge = edge
    if (edge.start === dragVertex.id) nextEdge = edge
  }
  let prevPrevEdge
  let nextNextEdge
  for (let edge of Object.values(transSideGraph.edges)) {
    if (edge.end === prevEdge?.start) prevPrevEdge = edge
    if (edge.start === nextEdge?.end) nextNextEdge = edge
  }

  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(AngleSnappingDist, position)

  const snapLines = []
  if (prevEdge && prevPrevEdge) {
    const v0 = transSideGraph.vertices[prevEdge.start]
    const v1 = transSideGraph.vertices[prevPrevEdge.start]
    let snapAngleLineData = getAnglesSnapLineData(v0, v1, position)
    snapLines.push(snapAngleLineData)
  }
  if (nextEdge && nextNextEdge) {
    const v0 = transSideGraph.vertices[nextEdge.end]
    const v1 = transSideGraph.vertices[nextNextEdge.end]
    let snapAngleLineData = getAnglesSnapLineData(v0, v1, position)
    snapLines.push(snapAngleLineData)
  }
  let snapLineData: any
  snapLines.forEach((snapLine) => {
    if (!snapLineData || snapLine.distToLine < snapLineData.distToLine) snapLineData = snapLine
  })
  if (snapLineData && snapLineData.distToLine < WeightedSnappingDist) {
    return { snappedPosition: snapLineData.pointOnLine, snapped: true }
  }
  return { snappedPosition: position, snapped: false }
}

function getSnapToDirections({
  position,
  dragVertex,
  transSideGraph,
}: {
  position: Vector3
  dragVertex: { x: number; y: number; z: number; id: string }
  transSideGraph: GraphZ
}) {
  return snapToNeighbourAngle({ position, dragVertex, transSideGraph })
}

type PointXY = { x: number; y: number }
function getAngle(p0: PointXY, p1: PointXY, p2: PointXY) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function getCornerBuffer(width: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = width / Math.cos(absAngle - Math.PI / 2)
    const dist2 = width / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (width * (1 - Math.cos(absAngle))) / Math.sin(absAngle)
  return Math.abs(shift)
}

function getSnapToSection(
  position: Vector3,
  v0: GraphVertex,
  v1: GraphVertex,
  sectionLength: number,
  width: number,
  lineAlignment: string,
  startEnd: 1 | -1,
  sectionDistances: number[],
  cornerLegDistance: number,
) {
  const lineLength = ((position.x - v0.x) ** 2 + (position.y - v0.y) ** 2) ** 0.5
  const unitVec = [(position.x - v0.x) / lineLength, (position.y - v0.y) / lineLength]

  const cornerAngle = getAngle(position, v0, v1)
  const direction = cornerAngle > 0 ? 1 : -1
  let cornerBuffer = getCornerBuffer(0.5 * width, cornerAngle)
  if (
    (lineAlignment === "left" && direction * startEnd > 0) ||
    (lineAlignment === "right" && direction * startEnd < 0)
  ) {
    cornerBuffer = 0
  }
  if (
    (lineAlignment === "right" && direction * startEnd > 0) ||
    (lineAlignment === "left" && direction * startEnd < 0)
  ) {
    cornerBuffer = getCornerBuffer(width, cornerAngle)
  }

  let distToClosestSection = cornerBuffer + cornerLegDistance

  for (let i = 0; i < 100; i++) {
    const sectionDistance = sectionDistances[i] || sectionLength
    if (lineLength < distToClosestSection + 0.5 * sectionDistance) {
      break
    }
    distToClosestSection += sectionDistance
  }

  const pointOnSection = new Vector3(
    v0.x + distToClosestSection * unitVec[0],
    v0.y + distToClosestSection * unitVec[1],
    position.z,
  )

  const distToSection = Math.abs(distToClosestSection - lineLength)

  return {
    pointOnSection,
    distToSection,
  }
}

type SnapToSectionLengthProps = {
  position: Vector3
  dragVertex: { x: number; y: number; z: number; id: string }
  transSideGraph: GraphZ
  sectionDistanceDict: SectionDistanceDict
  parameters: {
    width: number
    lineAlignment: string
    sectionProps: SectionProps
  }
}

function snapToSectionLength({
  dragVertex,
  position,
  transSideGraph,
  sectionDistanceDict,
  parameters,
}: SnapToSectionLengthProps) {
  const { width, lineAlignment } = parameters
  let prevEdge
  let nextEdge
  for (let edge of Object.values(transSideGraph.edges)) {
    if (edge.end === dragVertex.id) prevEdge = edge
    if (edge.start === dragVertex.id) nextEdge = edge
  }
  let prevPrevEdge
  let nextNextEdge
  for (let edge of Object.values(transSideGraph.edges)) {
    if (edge.end === prevEdge?.start) prevPrevEdge = edge
    if (edge.start === nextEdge?.end) nextNextEdge = edge
  }

  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(AngleSnappingDist, position)

  const firstVertex = !prevEdge
  if (firstVertex && nextEdge && nextNextEdge) {
    const v0 = transSideGraph.vertices[nextEdge.end]
    const v1 = transSideGraph.vertices[nextNextEdge.end]

    const { sectionDistances, defaultDistance, endCornerLeg } = sectionDistanceDict[nextEdge.id]
    const snapData = getSnapToSection(
      position,
      v0,
      v1,
      defaultDistance,
      width,
      lineAlignment,
      1,
      sectionDistances,
      endCornerLeg,
    )
    if (snapData.distToSection < WeightedSnappingDist)
      return { snappedPosition: snapData.pointOnSection, snapped: true }
  }

  const lastVertex = !nextEdge
  if (lastVertex && prevEdge && prevPrevEdge) {
    const v0 = transSideGraph.vertices[prevEdge.start]
    const v1 = transSideGraph.vertices[prevPrevEdge.start]
    const { sectionDistances, defaultDistance, startCornerLeg } = sectionDistanceDict[prevEdge.id]
    const snapData = getSnapToSection(
      position,
      v0,
      v1,
      defaultDistance,
      width,
      lineAlignment,
      -1,
      sectionDistances,
      startCornerLeg,
    )
    if (snapData.distToSection < WeightedSnappingDist)
      return { snappedPosition: snapData.pointOnSection, snapped: true }
  }

  return { snappedPosition: position, snapped: false }
}

type SnapToAngleAndOrSectionProps = {
  position: Vector3
  dragVertex: { x: number; y: number; z: number; id: string }
  transSideGraph: GraphZ
  sectionDistanceDict: SectionDistanceDict
  parameters: {
    width: number
    lineAlignment: string
    sectionToggle: boolean
    sectionProps: SectionProps
  }
}

function getSnappedToSection({
  dragVertex,
  position,
  transSideGraph,
  sectionDistanceDict,
  parameters,
}: SnapToAngleAndOrSectionProps) {
  if (!parameters.sectionToggle) return { snappedPosition: position, snapped: false }
  if (Object.keys(transSideGraph.edges).length === 0) return { snappedPosition: position, snapped: false }

  const simpleEdge = Object.keys(transSideGraph.edges).length === 1
  if (simpleEdge) {
    const snappedSimpleEdge = snapToSectionsSimpleEdge({
      transSideGraph,
      dragVertex,
      position,
      sectionDistanceDict,
    })
    return {
      snappedPosition: snappedSimpleEdge.snappedPosition,
      snapped: snappedSimpleEdge.snapped,
    }
  }

  const snappedToSection = snapToSectionLength({
    dragVertex,
    position: position,
    transSideGraph,
    sectionDistanceDict,
    parameters,
  })
  return {
    snappedPosition: snappedToSection.snappedPosition,
    snapped: snappedToSection.snapped,
  }
}

type DragVertex = { x: number; y: number; z: number; id: string }
type SnapVertexOnDragProps = {
  position: Vector3
  transSideGraph: GraphZ
  dragVertex: DragVertex
  fixedInputData: VertexDragInputData | undefined
  parameters: any
  otherBuildingsSnapData: OtherBuildingDragSnapData
  shapeToolLines: CandidateLine[]
}

type DragVertexType = "startDrag" | "midDrag" | "endDrag"
function getDragVertexType(dragVertex: { x: number; y: number; z: number; id: string }, graph: Graph): DragVertexType {
  let start = false
  let end = false
  Object.values(graph.edges).forEach((edge) => {
    if (edge.start === dragVertex.id) start = true
    if (edge.end === dragVertex.id) end = true
  })
  if (!start) return "endDrag"
  if (!end) return "startDrag"
  return "midDrag"
}

function getFixedSnapType(
  fixedInputData: VertexDragInputData | undefined,
  transSideGraph: Graph,
  dragVertex: DragVertex,
) {
  const prevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === dragVertex.id
  })
  const prevPrevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === prevEdge?.start
  })

  const prevVertex = prevEdge?.start ? transSideGraph.vertices[prevEdge.start] : undefined
  const prevPrevVertex = prevPrevEdge?.start ? transSideGraph.vertices[prevPrevEdge.start] : undefined

  const nextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === dragVertex.id
  })
  const nextNextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === nextEdge?.end
  })
  const nextVertex = nextEdge?.end ? transSideGraph.vertices[nextEdge.end] : undefined
  const nextNextVertex = nextNextEdge?.end ? transSideGraph.vertices[nextNextEdge.end] : undefined

  if (fixedInputData?.fixedPrevCornerAngle !== undefined && prevVertex && prevPrevVertex) {
    const pivotId = prevVertex.id
    const pivot = { x: prevVertex.x, y: prevVertex.y }
    const unit = getUnitVectorXY(prevPrevVertex, prevVertex)
    const normal = getUnitNormalVectorXY(prevPrevVertex, prevVertex)

    const angle = fixedInputData.fixedPrevCornerAngle
    const dx = Math.cos(angle) * unit.x + Math.sin(angle) * normal.x
    const dy = Math.cos(angle) * unit.y + Math.sin(angle) * normal.y
    const direction = { x: dx, y: dy }
    if (fixedInputData?.fixedPrevEdgeLength !== undefined) {
      return {
        fixedAngle: true,
        fixedLength: true,
        pivotId,
        pivot,
        direction,
        distToPivot: fixedInputData.fixedPrevEdgeLength,
      }
    }
    return { fixedAngle: true, pivotId, pivot, direction }
  }

  if (fixedInputData?.fixedNextCornerAngle !== undefined && nextVertex && nextNextVertex) {
    const pivotId = nextVertex.id
    const pivot = { x: nextVertex.x, y: nextVertex.y }

    const unit = getUnitVectorXY(nextNextVertex, nextVertex)
    const normal = getUnitNormalVectorXY(nextNextVertex, nextVertex)

    const angle = fixedInputData.fixedNextCornerAngle
    const dx = Math.cos(angle) * unit.x + Math.sin(angle) * normal.x
    const dy = Math.cos(angle) * unit.y + Math.sin(angle) * normal.y
    const direction = { x: dx, y: dy }
    if (fixedInputData?.fixedNextEdgeLength) {
      return { fixedAngle: true, fixedLength: true, pivot, direction, distToPivot: fixedInputData.fixedNextEdgeLength }
    }
    return { fixedAngle: true, pivotId, pivot, direction }
  }

  if (fixedInputData?.fixedPrevEdgeLength !== undefined && prevVertex) {
    const pivotId = prevVertex.id
    const pivot = { x: prevVertex.x, y: prevVertex.y }
    return { fixedLength: true, pivotId, pivot, distToPivot: fixedInputData.fixedPrevEdgeLength }
  }

  if (fixedInputData?.fixedNextEdgeLength !== undefined && nextVertex) {
    const pivotId = nextVertex.id
    const pivot = { x: nextVertex.x, y: nextVertex.y }
    return { fixedLength: true, pivotId, pivot, distToPivot: fixedInputData.fixedNextEdgeLength }
  }

  return undefined
}

function snapAlongFixedAngleAndFixedLength(
  fixedSnapType: any,
  dragVertex: DragVertex,
  dragVertexType: DragVertexType,
  position: Vector3,
) {
  const { pivot, pivotId, direction, distToPivot } = fixedSnapType

  const unit = getUnitVectorXY(pivot, position)

  const sign = unit.x * direction.x + unit.y * direction.y > 0 ? 1 : -1

  const x = pivot.x + direction.x * distToPivot * sign
  const y = pivot.y + direction.y * distToPivot * sign
  const snappedPosition = new Vector3(x, y, position.z)

  const snappedToVertexId = distToPivot === 0 ? pivotId : undefined

  return { snappedPosition, dragVertexType, dragVertexId: dragVertex.id, snappedToVertexId }
}

function snapToFixedLength(
  fixedSnapType: any,
  dragVertex: DragVertex,
  dragVertexType: DragVertexType,
  position: Vector3,
) {
  const { pivotId, pivot, distToPivot } = fixedSnapType

  const unit = getUnitVectorXY(pivot, position)
  const x = pivot.x + distToPivot * unit.x
  const y = pivot.y + distToPivot * unit.y
  const snappedPosition = new Vector3(x, y, position.z)

  const snappedToVertexId = distToPivot === 0 ? pivotId : undefined

  return { snappedPosition, dragVertexType, dragVertexId: dragVertex.id, snappedToVertexId }
}

function snapAlongFixedAngle({
  fixedSnapType,
  dragVertex,
  dragVertexType,
  position,
  transSideGraph,
  sectionDistanceDict,
  parameters,
  shapeToolLines,
}: {
  fixedSnapType: any
  dragVertex: DragVertex
  dragVertexType: DragVertexType
  position: Vector3
  transSideGraph: GraphZ
  sectionDistanceDict: SectionDistanceDict
  parameters: any
  shapeToolLines: CandidateLine[]
}) {
  const WeightedVertexSnappingDist = pixelsToMetersAtPositionStatic(VertexSnappingDist, position)
  const { pivot, direction, pivotId } = fixedSnapType
  let dist = (position.x - pivot.x) * direction.x + (position.y - pivot.y) * direction.y
  const x = pivot.x + direction.x * dist
  const y = pivot.y + direction.y * dist
  const snappedPosition = new Vector3(x, y, position.z)

  if (Math.abs(dist) < WeightedVertexSnappingDist) {
    return { snappedPosition: pivot, dragVertexType, dragVertexId: dragVertex.id, snappedToVertexId: pivotId }
  }

  const unitDirectionVec = new Vector3(direction.x, direction.y)
  const snappedToLine = snapToShapeToolLinesFixedAngle(snappedPosition, pivot, unitDirectionVec, shapeToolLines)
  if (snappedToLine.snapped) {
    return {
      snappedPosition: snappedToLine.snappedPosition,
      dragVertexType,
      dragVertexId: dragVertex.id,
      snappedToLines: snappedToLine.snappedToLines,
    }
  }

  const snappedToSection = getSnappedToSection({
    dragVertex,
    position: snappedPosition,
    transSideGraph,
    sectionDistanceDict,
    parameters,
  })
  if (snappedToSection.snapped) {
    return {
      snappedPosition: snappedToSection.snappedPosition,
      dragVertexType,
      dragVertexId: dragVertex.id,
    }
  }

  return { snappedPosition, dragVertexType, dragVertexId: dragVertex.id }
}

function snapToSectionAfterSnapToShapeToolLine({
  dragVertex,
  transSideGraph,
  snappedPosition,
  xLineSnapData,
}: {
  dragVertex: DragVertex
  transSideGraph: Graph
  snappedPosition: Vector3
  xLineSnapData: any
}) {
  if (xLineSnapData.snapType !== "xLine") return false
  const line = xLineSnapData.snappedToLines[0]

  let prevVertexId: string | undefined
  let nextVertexId: string | undefined
  for (let edge of Object.values(transSideGraph.edges)) {
    if (edge.start === dragVertex.id) nextVertexId = edge.end
    if (edge.end === dragVertex.id) prevVertexId = edge.start
  }
  if (nextVertexId !== undefined && prevVertexId !== undefined) return false

  let prevPoint
  if (prevVertexId !== undefined) prevPoint = transSideGraph.vertices[prevVertexId]
  else if (nextVertexId !== undefined) prevPoint = transSideGraph.vertices[nextVertexId]

  if (prevPoint === undefined) return false

  const unitOne = getUnitVectorXY(prevPoint, snappedPosition)
  const unitNormalTwo = getUnitNormalVectorXY(line.start, line.end)

  return Math.abs(unitOne.x * unitNormalTwo.x + unitOne.y * unitNormalTwo.y) < 1e-8
}

export function getSnappedVertexOnDragData({
  position,
  dragVertex,
  fixedInputData,
  transSideGraph,
  parameters,
  otherBuildingsSnapData,
  shapeToolLines,
}: SnapVertexOnDragProps): {
  snappedPosition: Vector3
  dragVertexId: string
  snappedToVertexId?: string | undefined
  dragVertexType: DragVertexType
  otherBuildingSnapData?: any
  snappedToLines?: SnappingLine[]
} {
  const dragVertexType = getDragVertexType(dragVertex, transSideGraph)
  const sectionDistanceDict = getCustomSectionDistanceDict(parameters)

  const fixedSnapType = getFixedSnapType(fixedInputData, transSideGraph, dragVertex)
  if (fixedSnapType?.fixedAngle === true && fixedSnapType?.fixedLength === true) {
    return snapAlongFixedAngleAndFixedLength(fixedSnapType, dragVertex, dragVertexType, position)
  }
  if (fixedSnapType?.fixedAngle === true) {
    return snapAlongFixedAngle({
      fixedSnapType,
      dragVertex,
      dragVertexType,
      position,
      shapeToolLines,
      transSideGraph,
      sectionDistanceDict,
      parameters,
    })
  }
  if (fixedSnapType?.fixedLength === true) {
    return snapToFixedLength(fixedSnapType, dragVertex, dragVertexType, position)
  }

  const snappedToVertex = snapToVertex({ dragVertex, position, transSideGraph, otherBuildingsSnapData, dragVertexType })
  if (snappedToVertex) return { ...snappedToVertex, dragVertexType }

  const snappedToShapeToolLine = snapToShapeToolLines(position, shapeToolLines)
  if (snappedToShapeToolLine.snapped) {
    let snappedPosition = snappedToShapeToolLine.snappedPosition
    const snappedToLines = snappedToShapeToolLine?.snappedToLines || snappedToShapeToolLine.snappedToLines || []

    const shouldSnapToSection = snapToSectionAfterSnapToShapeToolLine({
      dragVertex,
      transSideGraph,
      snappedPosition,
      xLineSnapData: snappedToShapeToolLine,
    })

    if (shouldSnapToSection) {
      const snappedToSection = getSnappedToSection({
        dragVertex,
        position: snappedPosition,
        transSideGraph,
        sectionDistanceDict,
        parameters,
      })
      snappedPosition = snappedToSection.snappedPosition
    }

    return {
      snappedPosition,
      dragVertexId: dragVertex.id,
      dragVertexType,
      snappedToLines: snappedToLines,
    }
  }

  const snappedToDirection = getSnapToDirections({ position, dragVertex, transSideGraph })
  if (snappedToDirection.snapped) {
    let snappedPosition = snappedToDirection.snappedPosition
    const snappedToSection = getSnappedToSection({
      dragVertex,
      position: snappedPosition,
      transSideGraph,
      sectionDistanceDict,
      parameters,
    })
    snappedPosition = snappedToSection.snappedPosition
    return {
      snappedPosition,
      dragVertexId: dragVertex.id,
      dragVertexType,
    }
  }

  const snappedToSection = getSnappedToSection({
    dragVertex,
    position,
    transSideGraph,
    sectionDistanceDict,
    parameters,
  })
  if (snappedToSection.snapped) {
    return { snappedPosition: snappedToSection.snappedPosition, dragVertexId: dragVertex.id, dragVertexType }
  }

  return { snappedPosition: position, dragVertexId: dragVertex.id, dragVertexType }
}
