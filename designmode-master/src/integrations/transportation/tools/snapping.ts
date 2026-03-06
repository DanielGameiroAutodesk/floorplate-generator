import { Matrix4, Vector3 } from "three"

import { mousePosition } from "src/core/useMousePosition"
import { minBy } from "src/lib/array"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import { SNAPPING_SENSITIVITY_SQ } from "src/integrations/snapping/constants"
import sceneManager from "src/core/three/sceneManager"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { getGlobalTerrainPosition } from "src/integrations/composition-site-graph/tools/getGlobalTerrainPosition"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import type { SnapInfo } from "src/integrations/snapping/snappingEngine"
import type { SnappingLine } from "src/integrations/snapping/snapping"

export type Point = { id: string; position: Vector3 }
export type Segment = { edgeId: string; position: [Vector3, Vector3] }
export type SnappedPoint = { type: "point"; point: Point; distanceSq: number }
export type SnappedSegment = { type: "segment"; segment: Segment; distanceSq: number; point: Vector3 }
const NUMERICAL_PRECISION = 0.00001

export function snapPoints(points: Point[]): SnappedPoint | undefined {
  const ray = mousePosition.ray
  const pointsWithDistances: SnappedPoint[] = points.map((point) => ({
    type: "point",
    point: point,
    distanceSq: ray.distanceSqToPoint(point.position),
  }))
  if (pointsWithDistances.length === 0) return undefined
  pointsWithDistances.sort((a, b) => a.distanceSq - b.distanceSq)
  const closestToPoint = pointsWithDistances[0]
  const candidates: (SnappedPoint & { distanceToCamera: number })[] = pointsWithDistances
    .filter((x) => closestToPoint.distanceSq + NUMERICAL_PRECISION > x.distanceSq)
    .map((x) => ({ ...x, distanceToCamera: ray.origin.distanceTo(x.point.position) }))

  const closestCandidateToCamera = minBy(candidates, (dist) => dist.distanceToCamera)
  // TODO: Square rhs of the comparison to get consistent units and avoid pixel snap distance varying with distance to camera?
  if (
    closestCandidateToCamera &&
    closestCandidateToCamera.distanceSq <=
      pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, sceneManager.camera, closestCandidateToCamera.point.position)
  ) {
    return closestCandidateToCamera
  }
  return undefined
}

export function snapSegments(segments: Segment[]): SnappedSegment | undefined {
  let candidates: SnappedSegment[] = []
  for (let segment of segments) {
    const posOnSegment = new Vector3()
    const distSQ = mousePosition.ray.distanceSqToSegment(
      segment.position[0],
      segment.position[1],
      undefined,
      posOnSegment,
    )
    // TODO: Square rhs of the comparison to get consistent units and avoid pixel snap distance varying with distance to camera?
    if (distSQ < pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, sceneManager.camera, posOnSegment)) {
      candidates.push({ type: "segment", segment, distanceSq: distSQ, point: posOnSegment })
    }
  }

  return minBy(candidates, (ss) => ss.distanceSq)
}

function snapToContext(
  points: Vector3[],
  terrainElevationAt: (x: number, y: number) => number,
  additionalSnappingLines: SnappingLine[],
) {
  const lastPlacedVertex: Vector3 | undefined = points[points.length - 1]
  const globalPosition = lastPlacedVertex
    ? getGlobalTerrainPosition(lastPlacedVertex, new Matrix4(), terrainElevationAt)
    : undefined
  // TODO: Consider enabling passing precomputed octree in API
  return snappingAPIStateful.snap(mousePosition, globalPosition, additionalSnappingLines)
}

export function getPosition(
  points: Vector3[],
  snappingActive: boolean,
  terrainElevationAt: (x: number, y: number) => number,
  snappingLines: SnappingLine[],
  setSnapInfo?: (snapInfo: SnapInfo) => void,
) {
  const snappedToContext = snappingActive ? snapToContext(points, terrainElevationAt, snappingLines) : undefined
  const previousPosition = points[points.length - 1]
  const snappedToEndPoint = snappingActive
    ? snapPoints(previousPosition ? [{ position: previousPosition, id: "" }] : [])?.point
    : undefined
  let pos: Vector3 | null = null

  if (snappedToEndPoint) {
    pos = snappedToEndPoint.position.clone()
  } else if (snappedToContext) {
    setSnapInfo && setSnapInfo(snappedToContext)
    pos = snappedToContext.position.clone()
  } else {
    const result = raycastApi.raycastTerrain()
    pos = result ? new Vector3(result.position.x, result.position.y, result.position.z) : null
  }
  return pos
}

export function curveToolAdditionalSnappingLines(controlPoints: Vector3[]): SnappingLine[] {
  if (controlPoints.length < 2) return []
  const [startPoint, endpoint] = controlPoints.slice(-2)
  const direction = endpoint.clone().sub(startPoint).normalize()
  const orthogonalDirection = new Vector3(-direction.y, direction.x, 0)
  const extendedEndPoint = endpoint.clone().add(direction.multiplyScalar(500))
  const orthogonalLeft = endpoint.clone().add(orthogonalDirection.clone().multiplyScalar(500))
  const orthogonalRight = endpoint.clone().add(orthogonalDirection.clone().multiplyScalar(-500))
  return [
    snappingAPIStateful.createSnappingLineFromLine(endpoint, extendedEndPoint, true),
    snappingAPIStateful.createSnappingLineFromLine(orthogonalLeft, orthogonalRight, true),
  ]
}
