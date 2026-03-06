import { Vector3 } from "three"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import type { CandidateLine } from "src/integrations/snapping/snappingEngine"
import {
  getClosestPointOnLine,
  getDistBetweenPoints,
  getDistFromPointToLine,
} from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"

const XLineSnappingDistLine = 30
const XLineSnappingDistPoint = 30

export function snapToShapeToolLinesFixedAngle(
  position: Vector3,
  prevPoint: Vector3,
  unitVec: Vector3,
  shapeToolSnapLines: CandidateLine[],
) {
  const WeightedSnappingDistLine = pixelsToMetersAtPositionStatic(XLineSnappingDistLine, position)

  const normalVec = { x: unitVec.y, y: -unitVec.x }

  let minDistToLine = Infinity
  let closestLine
  let snappedPosition
  for (let xLine of shapeToolSnapLines) {
    const { start, end } = xLine.line

    const tStart = (start.x - prevPoint.x) * normalVec.x + (start.y - prevPoint.y) * normalVec.y
    const tEnd = (end.x - prevPoint.x) * normalVec.x + (end.y - prevPoint.y) * normalVec.y

    if (tStart > 0 && tEnd > 0) continue
    if (tStart < 0 && tEnd < 0) continue

    const x = (start.x * tEnd) / (tEnd - tStart) + (end.x * tStart) / (tStart - tEnd)
    const y = (start.y * tEnd) / (tEnd - tStart) + (end.y * tStart) / (tStart - tEnd)

    const distToLine = ((position.x - x) ** 2 + (position.y - y) ** 2) ** 0.5
    if (distToLine < Math.min(WeightedSnappingDistLine, minDistToLine)) {
      minDistToLine = distToLine
      closestLine = xLine
      snappedPosition = new Vector3(x, y, position.z)
    }
  }
  if (!closestLine || !snappedPosition) {
    return { snappedPosition: position, snapped: false, snappedToLines: [] }
  }

  return {
    snappedPosition: snappedPosition,
    snapped: true,
    snappedToLines: [closestLine.line],
    snappingDistance: minDistToLine,
  }
}

export function snapToShapeToolLines(position: Vector3, shapeToolSnapLines: CandidateLine[]) {
  const WeightedSnappingDistLine = pixelsToMetersAtPositionStatic(XLineSnappingDistLine, position)
  const WeightedSnappingDistPoint = pixelsToMetersAtPositionStatic(XLineSnappingDistPoint, position)

  let minDistToLine = Infinity
  let closestLine
  for (let xLine of shapeToolSnapLines) {
    const { start, end } = xLine.line
    const distToLine = getDistFromPointToLine(start, end, position)
    if (distToLine < Math.min(WeightedSnappingDistLine, minDistToLine)) {
      minDistToLine = distToLine
      closestLine = xLine
    }
  }

  if (!closestLine) {
    return { snappedPosition: position, snapped: false, snappedToLines: [] }
  }

  const { start, center, end, onTerrain } = closestLine.line
  const { x, y, z } = getClosestPointOnLine(start, end, position)

  const distToStart = getDistBetweenPoints(start, position)
  const distToCenter = getDistBetweenPoints(center, position)
  const distToEnd = getDistBetweenPoints(end, position)
  const minPointDist = Math.min(distToStart, distToCenter, distToEnd)

  if (distToStart === minPointDist && distToStart < WeightedSnappingDistPoint) {
    const { x, y, z } = start
    const snappedPosition = onTerrain ? new Vector3(x, y, position.z) : new Vector3(x, y, z)
    return {
      snappedPosition: snappedPosition,
      snapped: true,
      snapType: "xPoint",
      snappedToLines: [closestLine.line],
    }
  }

  if (distToEnd === minPointDist && distToEnd < WeightedSnappingDistPoint) {
    const { x, y, z } = end
    const snappedPosition = onTerrain ? new Vector3(x, y, position.z) : new Vector3(x, y, z)
    return {
      snappedPosition: snappedPosition,
      snapped: true,
      snapType: "xPoint",
      snappedToLines: [closestLine.line],
    }
  }

  if (distToCenter === minPointDist && distToCenter < WeightedSnappingDistPoint) {
    const { x, y, z } = center
    const snappedPosition = onTerrain ? new Vector3(x, y, position.z) : new Vector3(x, y, z)
    return {
      snappedPosition: snappedPosition,
      snapped: true,
      snapType: "xPoint",
      snappedToLines: [closestLine.line],
    }
  }

  const snappedPosition = onTerrain ? new Vector3(x, y, position.z) : new Vector3(x, y, z)
  return {
    snappedPosition: snappedPosition,
    snapped: true,
    snapType: "xLine",
    snappedToLines: [closestLine.line],
  }
}
