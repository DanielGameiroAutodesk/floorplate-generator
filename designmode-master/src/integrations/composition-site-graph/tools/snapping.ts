import type { Matrix4 } from "three"
import { Vector3 } from "three"

import { mousePosition } from "src/core/useMousePosition"
import { minBy } from "src/lib/array"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import { SNAPPING_SENSITIVITY_SQ } from "src/integrations/snapping/constants"
import sceneManager from "src/core/three/sceneManager"
import type { Graph } from "src/integrations/composition-site-graph/graph/types"
import { getGlobalTerrainPosition } from "./getGlobalTerrainPosition"

type Point = { id: string; position: Vector3 }
type Segment = { edgeId: string; internalEdgeId: string; position: [Vector3, Vector3] }
export type SnappedPoint = { type: "point"; point: Point; distanceSq: number }
export type SnappedSegment = { type: "segment"; segment: Segment; distanceSq: number; point: Vector3 }
const NUMERICAL_PRECISION = 0.00001

function snapPoints(points: Point[]): SnappedPoint | undefined {
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

function snapSegments(segments: Segment[]): SnappedSegment | undefined {
  let candidates: SnappedSegment[] = []
  for (let segment of segments) {
    const posOnSegment = new Vector3()
    const distSQ = mousePosition.ray.distanceSqToSegment(segment.position[0], segment.position[1], posOnSegment)
    // TODO: Square rhs of the comparison to get consistent units and avoid pixel snap distance varying with distance to camera?
    if (distSQ < pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, sceneManager.camera, posOnSegment)) {
      candidates.push({ type: "segment", segment, distanceSq: distSQ, point: posOnSegment })
    }
  }

  return minBy(candidates, (ss) => ss.distanceSq)
}

/**
 * Returns local position
 */
export function snapGraph(
  g: Graph,
  transform: Matrix4,
  getZ: (x: number, y: number) => number,
): SnappedPoint | SnappedSegment | undefined {
  const globalPoints = Object.entries(g.vertices).map(([id, v]) => ({
    id,
    position: getGlobalTerrainPosition(v, transform, getZ),
  }))

  const transformInverse = transform.clone().invert()

  const snappedPoint = snapPoints(globalPoints)
  if (snappedPoint) {
    const localPosition = snappedPoint.point.position.clone().applyMatrix4(transformInverse)
    return {
      ...snappedPoint,
      point: {
        ...snappedPoint.point,
        position: localPosition,
      },
    }
  }

  const snappedSegment = snapSegments(
    Object.entries(g._edges).map(([eid, e]): Segment => {
      const start = getGlobalTerrainPosition(g._vertices[e.start], transform, getZ)
      const end = getGlobalTerrainPosition(g._vertices[e.end], transform, getZ)
      return {
        edgeId: e.superEdgeId,
        internalEdgeId: eid,
        position: [
          new Vector3(start.x, start.y, getZ(start.x, start.y)),
          new Vector3(end.x, end.y, getZ(end.x, end.y)),
        ],
      }
    }),
  )
  if (snappedSegment) {
    return {
      ...snappedSegment,
      point: snappedSegment.point.clone().applyMatrix4(transformInverse),
      segment: {
        ...snappedSegment.segment,
        position: [
          snappedSegment.segment.position[0].clone().applyMatrix4(transformInverse),
          snappedSegment.segment.position[1].clone().applyMatrix4(transformInverse),
        ],
      },
    }
  }

  return undefined
}
