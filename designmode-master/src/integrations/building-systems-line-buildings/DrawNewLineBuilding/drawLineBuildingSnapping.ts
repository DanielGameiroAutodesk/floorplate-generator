import { Vector3 } from "three"
import type { DrawLineFixedInputs } from "src/integrations/building-systems-line-buildings/FloatingInputBox/DrawLineBuildingInputBox"
import { snapPointToDirection } from "./drawSnapping"
import { snapPointToSection } from "./snapToSections"
import { snapToShapeToolLines, snapToShapeToolLinesFixedAngle } from "./snapToShapeToolLines"
import { getDirectionalSnapLines } from "./makeSnapLines"
import { pointPointDistanceXY } from "src/integrations/building-systems-common/geometryHelpers"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import type { CandidateLine } from "src/integrations/snapping/snappingEngine"
import { getUnitNormalVectorXY, getUnitVectorXY } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"
import type { LineAlignment } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"

function snapToSectionAfterSnapToXLine(prevPoint: Vector3, snappedPosition: Vector3, xLineSnapData: any) {
  if (xLineSnapData.snapType !== "xLine") return false
  const line = xLineSnapData.snappedToLines[0]

  const unitOne = getUnitVectorXY(prevPoint, snappedPosition)
  const unitNormalTwo = getUnitNormalVectorXY(line.start, line.end)

  return Math.abs(unitOne.x * unitNormalTwo.x + unitOne.y * unitNormalTwo.y) < 1e-8
}

function getSnappedPositionWithFixedAngle({
  line,
  fixedAngle,
  position,
  parameters,
  startSnap,
  shapeToolSnapLines,
}: {
  line: Vector3[]
  fixedAngle: number
  position: Vector3
  parameters: any
  startSnap: any
  shapeToolSnapLines: CandidateLine[]
}): { snappedPosition: Vector3; snapped: boolean; visualSnapData?: any } {
  const n = line.length
  const prevPoint = line[n - 1]
  const prevPrevPoint = line[n - 2]
  const unit = getUnitVectorXY(prevPrevPoint, prevPoint)
  const normal = getUnitNormalVectorXY(prevPrevPoint, prevPoint)

  const dx = unit.x * Math.cos(fixedAngle) + normal.x * Math.sin(fixedAngle)
  const dy = unit.y * Math.cos(fixedAngle) + normal.y * Math.sin(fixedAngle)

  const length = (position.x - prevPoint.x) * dx + (position.y - prevPoint.y) * dy

  const x = dx * length + prevPoint.x
  const y = dy * length + prevPoint.y

  let snappedPosition = new Vector3(x, y, position.z)

  const snappedToSection = snapPointToSection({ position: snappedPosition, line, parameters, startSnap })
  if (snappedToSection.snapped) {
    return { snappedPosition: snappedToSection.snappedPosition, snapped: true }
  }

  const unitDirectionVec = new Vector3(dx, dy)
  const snappedToLine = snapToShapeToolLinesFixedAngle(snappedPosition, prevPoint, unitDirectionVec, shapeToolSnapLines)
  if (snappedToLine.snapped) {
    return {
      snappedPosition: snappedToLine.snappedPosition,
      snapped: true,
      visualSnapData: { lines: snappedToLine.snappedToLines },
    }
  }

  return { snappedPosition, snapped: false }
}

function getSnappedPositionWithFixedLength({
  line,
  fixedLength,
  position,
  directionalSnapLines,
}: {
  line: Vector3[]
  fixedLength: number
  position: Vector3
  directionalSnapLines: SnapFromLines
}) {
  const n = line.length
  const prevPoint = line[n - 1]

  let snappedPosition = position

  snappedPosition = snapPointToDirection({ position: snappedPosition, directionalSnapLines }).snappedPosition

  const unit = getUnitVectorXY(prevPoint, snappedPosition)
  const x = unit.x * fixedLength + prevPoint.x
  const y = unit.y * fixedLength + prevPoint.y
  snappedPosition = new Vector3(x, y, snappedPosition.z)

  return { snappedPosition }
}

function getSnappedPositionWithFixedLengthAndFixedAngle({
  line,
  fixedLength,
  fixedAngle,
  position,
}: {
  line: Vector3[]
  fixedLength: number
  fixedAngle: number
  position: Vector3
}) {
  const n = line.length
  const prevPoint = line[n - 1]
  const prevPrevPoint = line[n - 2]
  const unit = getUnitVectorXY(prevPrevPoint, prevPoint)
  const normal = getUnitNormalVectorXY(prevPrevPoint, prevPoint)

  const x = unit.x * fixedLength * Math.cos(fixedAngle) + normal.x * fixedLength * Math.sin(fixedAngle) + prevPoint.x
  const y = unit.y * fixedLength * Math.cos(fixedAngle) + normal.y * fixedLength * Math.sin(fixedAngle) + prevPoint.y

  const snappedPosition = new Vector3(x, y, position.z)
  return { snappedPosition }
}

type SnapFromLines = [Vector3, Vector3][]
const VertexSnappingDist = 40
function snapNonFirstPoint({
  position,
  connectionPoints,
  line,
  parameters,
  shapeToolSnapLines,
  drawFromLines,
  startSnap,
  fixedInputs,
}: {
  position: Vector3
  connectionPoints: ConnectToOtherBuildingPoint[]
  line: Vector3[]
  parameters: Parameters
  shapeToolSnapLines: CandidateLine[]
  drawFromLines: SnapFromLines
  startSnap: ConnectToOtherBuildingPoint
  fixedInputs: DrawLineFixedInputs
}) {
  const directionalSnapLines = getDirectionalSnapLines({ line, startSnap, drawFromLines })
  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(VertexSnappingDist, position)

  if (fixedInputs.fixedLength === undefined) {
    const n = line.length
    const distToLastPoint = pointPointDistanceXY(position, line[n - 1])
    if (distToLastPoint < WeightedSnappingDist) return { snappedPosition: line[n - 1], snapped: true, closed: false }
  }
  if (fixedInputs.fixedLength !== undefined && fixedInputs.fixedAngle !== undefined) {
    const fixedLength = fixedInputs.fixedLength
    const fixedAngle = fixedInputs.fixedAngle
    const { snappedPosition } = getSnappedPositionWithFixedLengthAndFixedAngle({
      line,
      fixedLength,
      fixedAngle,
      position,
    })
    return { snappedPosition, snapped: false, closed: false, snapFromLines: [] }
  }
  if (fixedInputs.fixedLength !== undefined && fixedInputs.fixedAngle === undefined) {
    const fixedLength = fixedInputs.fixedLength
    const { snappedPosition } = getSnappedPositionWithFixedLength({
      line,
      fixedLength,
      position,
      directionalSnapLines,
    })
    return { snappedPosition, snapped: false, closed: false, snapFromLines: [] }
  }
  if (fixedInputs.fixedLength === undefined && fixedInputs.fixedAngle !== undefined) {
    const fixedAngle = fixedInputs.fixedAngle
    const { snappedPosition, snapped, visualSnapData } = getSnappedPositionWithFixedAngle({
      line,
      fixedAngle,
      position,
      parameters,
      startSnap,
      shapeToolSnapLines,
    })
    return { snappedPosition, snapped, closed: false, snapFromLines: [], visualSnapData }
  }
  let minDist = Infinity
  let closestPoint
  let snapFromLines: SnapFromLines = []
  for (let snapPoint of connectionPoints) {
    const pos = snapPoint.point
    const dist = ((position.x - pos.x) ** 2 + (position.y - pos.y) ** 2) ** 0.5
    if (dist < minDist) {
      closestPoint = snapPoint
      minDist = dist
    }
  }
  if (closestPoint && minDist < WeightedSnappingDist) {
    snapFromLines = [[closestPoint.prevPoint, closestPoint.point]]
    return {
      snappedPosition: closestPoint.point,
      snapPoint: closestPoint,
      snapped: true,
      closed: false,
      snapFromLines: snapFromLines,
    }
  }

  const prevPoint = line[line.length - 1]
  const snapToFirst = line.length > 2 && !startSnap
  if (snapToFirst) {
    const firstPoint = line[0]
    const dist = ((position.x - firstPoint.x) ** 2 + (position.y - firstPoint.y) ** 2) ** 0.5
    if (dist < WeightedSnappingDist) {
      return { snappedPosition: firstPoint, snapped: true, closed: true }
    }
  }

  let snappedPosition = position
  let snapped = false
  let snappedToLines: any = []
  const xLineSnapData = snapToShapeToolLines(position, shapeToolSnapLines)
  if (xLineSnapData.snapped) {
    snapped = true
    snappedPosition = xLineSnapData.snappedPosition
    snappedToLines = xLineSnapData.snappedToLines
    snapFromLines = snappedToLines.map((line: any) => [line.start, line.end])
  }
  if (!xLineSnapData.snapped) {
    snappedPosition = snapPointToDirection({ position: snappedPosition, directionalSnapLines }).snappedPosition
    snappedPosition = snapPointToSection({ position: snappedPosition, line, parameters, startSnap }).snappedPosition
  } else if (snapToSectionAfterSnapToXLine(prevPoint, snappedPosition, xLineSnapData)) {
    snappedPosition = snapPointToSection({ position: snappedPosition, line, parameters, startSnap }).snappedPosition
  }

  return {
    snappedPosition: snappedPosition,
    snapped,
    closed: false,
    visualSnapData: { lines: snappedToLines },
    snapFromLines,
  }
}

function snapFirstPoint({
  position,
  connectionPoints,
  shapeToolSnapLines,
}: {
  position: Vector3
  connectionPoints: ConnectToOtherBuildingPoint[]
  shapeToolSnapLines: CandidateLine[]
}) {
  const WeightedSnappingDist = pixelsToMetersAtPositionStatic(VertexSnappingDist, position)
  let snapFromLines: [Vector3, Vector3][] = []
  let minDist = Infinity
  let closestPoint
  for (let snapPoint of connectionPoints) {
    const pos = snapPoint.point
    const dist = ((position.x - pos.x) ** 2 + (position.y - pos.y) ** 2) ** 0.5
    if (dist < minDist) {
      closestPoint = snapPoint
      minDist = dist
    }
  }
  if (closestPoint && minDist < WeightedSnappingDist) {
    snapFromLines = [[closestPoint.point, closestPoint.prevPoint]]
    return { snappedPosition: closestPoint.point, snapPoint: closestPoint, snapped: true, closed: false, snapFromLines }
  }

  const shapeLineSnapData = snapToShapeToolLines(position, shapeToolSnapLines)
  if (shapeLineSnapData.snapped) {
    snapFromLines = shapeLineSnapData.snappedToLines.map((line: any) => [line.start, line.end])
    return {
      snappedPosition: shapeLineSnapData.snappedPosition,
      snapped: true,
      closed: false,
      visualSnapData: { lines: shapeLineSnapData.snappedToLines },
      snapFromLines,
    }
  }

  return { snappedPosition: position, snapped: false, closed: false }
}

export type ConnectToOtherBuildingPoint = {
  point: Vector3
  prevPoint: Vector3
  buildingID: string
  side: "start" | "end"
  height: number
  path: string
  id: string
}

type Parameters = { width: number; lineAlignment: LineAlignment; minSubBuildingLength: number }

export function getDrawLineBuildingSnappedPosition({
  position,
  connectionPoints,
  line,
  parameters,
  first,
  shapeToolSnapLines,
  drawFromLines,
  startSnap,
  fixedInputs,
}: {
  position: Vector3
  connectionPoints: ConnectToOtherBuildingPoint[]
  line: Vector3[]
  parameters: Parameters
  first: boolean
  shapeToolSnapLines: CandidateLine[]
  drawFromLines: SnapFromLines
  startSnap: ConnectToOtherBuildingPoint
  fixedInputs: DrawLineFixedInputs
}) {
  if (first) {
    return snapFirstPoint({ position, connectionPoints, shapeToolSnapLines })
  }
  return snapNonFirstPoint({
    position,
    connectionPoints,
    line,
    parameters,
    shapeToolSnapLines,
    drawFromLines,
    startSnap,
    fixedInputs,
  })
}
