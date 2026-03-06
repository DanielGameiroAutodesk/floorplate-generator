import { Vector3 } from "three"
import { raycast } from "src/core/terrain/2d-raytracer"
import type { AdjustmentFunction } from "src/integrations/draw/DrawAPI"
import { GeometryConstants } from "src/lib/three/geometryUtils"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"

const reusablePosition = new Vector3()

export const getPointOfLength = (lastPoint: Vector3, currentPoint: Vector3, length: number): Vector3 => {
  if (lastPoint.distanceTo(currentPoint) === 0) return currentPoint
  const segment = currentPoint.clone().sub(lastPoint)
  segment.setLength(length)
  return lastPoint.clone().add(segment)
}

const VecPositiveX = new Vector3(1)
export const SNAP_TO_LINE_LENGTH: (
  length: number,
  refPoint: Vector3,
  direction: "horizontal" | "vertical",
) => AdjustmentFunction = (length: number, refPoint: Vector3, direction) => (currentPos) => {
  if (currentPos.distanceTo(refPoint) === 0) {
    if (direction === "vertical") {
      return getPointOfLength(refPoint, refPoint.clone().add(GeometryConstants.UP), length)
    } else {
      return getPointOfLength(refPoint, refPoint.clone().add(VecPositiveX), length)
    }
  }

  return getPointOfLength(refPoint, currentPos, length)
}

export const SNAP_TO_LINE_LENGTH_TERRAIN: (
  length: number,
  startPoint: Vector3,
  terrainSamplerData: TerrainSamplerData,
) => AdjustmentFunction = (length: number, startPoint: Vector3, terrainSamplerData) => (position) => {
  reusablePosition.subVectors(position, startPoint).setZ(0).setLength(length).add(startPoint)
  reusablePosition.setZ(raycast(reusablePosition.x, reusablePosition.y, terrainSamplerData))

  return reusablePosition
}
