import type { Raycaster, Vector3 } from "three"
import { HOVER_DISTANCE_PX } from "./selectionCommon"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"

export function indexOfPointsInHoverDistance(mouse: Raycaster, snappingPoints: Vector3[]): number {
  const inDistance = snappingPoints
    .map((point, i) => ({
      point,
      distance: mouse.ray.distanceToPoint(point),
      originalIndex: i,
    }))
    .filter((p) => p.distance <= pixelsToMetersAtPosition(HOVER_DISTANCE_PX, mouse.camera, p.point))
    .sort((a, b) => a.distance - b.distance)

  if (inDistance.length > 0) {
    return inDistance[0].originalIndex
  } else {
    return -1
  }
}
