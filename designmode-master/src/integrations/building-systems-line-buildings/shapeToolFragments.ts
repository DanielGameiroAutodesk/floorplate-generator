import type { Raycaster } from "three"
import { Vector3 } from "three"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import { HOVER_DISTANCE_PX } from "src/integrations/tools-common/Drawing/shapeTool/subtools/Edit/selection/selectionCommon"

////
// Copy pasta from ShapeTool
///

export function indexOfVerticesInHoverDistance(
  mouse: Raycaster,
  vertices: { x: number; y: number; z: number; id: string }[],
): number {
  const inDistance = vertices
    .map((vertex) => {
      return new Vector3(vertex.x, vertex.y, vertex.z)
    })
    .map((point, i) => ({
      point,
      distance: mouse.ray.distanceToPoint(point),
      originalIndex: i,
    }))
    .filter((p) => p.distance <= pixelsToMetersAtPositionStatic(HOVER_DISTANCE_PX, p.point))
    .sort((a, b) => a.distance - b.distance)
  if (inDistance.length > 0) {
    return inDistance[0].originalIndex
  } else {
    return -1
  }
}
