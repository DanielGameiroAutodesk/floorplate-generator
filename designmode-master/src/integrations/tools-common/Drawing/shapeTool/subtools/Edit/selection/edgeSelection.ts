import type { Ray } from "three"
import { Frustum, Matrix4, Vector3 } from "three"
import { HOVER_DISTANCE_PX } from "./selectionCommon"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import sceneManager from "src/core/three/sceneManager"
import { subdivideLine } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import { projectPositionToSurface } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import ArrayUtils, { minBy } from "src/lib/array"
import type { Shape } from "src/lib/three/Shape/types"

type EdgeDistanceData = {
  edgeIdx: number
  distance: number
  pointOnEdge: Vector3
}

function inCameraFrustum(v: Vector3) {
  const camera = sceneManager.camera
  const cameraFrustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  )
  return cameraFrustum.containsPoint(v)
}

const MINIMUM_SUBDIVISION_LENGTH = 2
function edgeToLineSegmentsOnScreen(shape: Shape, edgeIdx: number, onTerrain: boolean): [Vector3, Vector3][] {
  const subSegments: [Vector3, Vector3][] = []
  const positions = shape.edges[edgeIdx].map((v) => shape.vertices[v]) as [Vector3, Vector3]

  if (!positions.some(inCameraFrustum)) return subSegments

  if (onTerrain) {
    const terrain = sceneManager.scene.getObjectByName("Terrain")
    const divisionLength = Math.max(
      MINIMUM_SUBDIVISION_LENGTH,
      pixelsToMetersAtPosition(15, sceneManager.camera, positions[0]),
    )

    let lineOnTerrain = subdivideLine(positions, divisionLength).map((v) => projectPositionToSurface(v, terrain))
    ArrayUtils.sliding2(lineOnTerrain).forEach((subseg) => subSegments.push(subseg))
  } else {
    subSegments.push(positions)
  }

  return subSegments.filter((subseg) => subseg.some(inCameraFrustum))
}

function distanceToEdge(shape: Shape, edgeIdx: number, onTerrain: boolean, ray: Ray): EdgeDistanceData {
  const subSegments = edgeToLineSegmentsOnScreen(shape, edgeIdx, onTerrain)

  const currentPointOnEdge = new Vector3()
  const edgeData = {
    edgeIdx,
    distance: Number.MAX_SAFE_INTEGER,
    pointOnEdge: new Vector3(),
  }
  subSegments.forEach(([start, end]) => {
    const distance = ray.distanceSqToSegment(start, end, undefined, currentPointOnEdge)
    if (distance < edgeData.distance) {
      edgeData.distance = distance
      edgeData.pointOnEdge.copy(currentPointOnEdge)
    }
  })
  return edgeData
}

export function indexOfEdgesInHoverDistance(
  ray: Ray,
  shape: Shape,
  onTerrain: boolean,
): { index: number; position: Vector3 } | { index: -1; position: undefined } {
  const lineSegmentsWithinSnappingDistance = shape.edges
    .map((edge, originalIdx) => {
      return distanceToEdge(shape, originalIdx, onTerrain, ray)
    })
    .filter((ls) => {
      return ls.distance <= pixelsToMetersAtPosition(HOVER_DISTANCE_PX, sceneManager.camera, ls.pointOnEdge)
    })

  if (lineSegmentsWithinSnappingDistance.length === 0) return { index: -1, position: undefined }

  let closestSegment = minBy(lineSegmentsWithinSnappingDistance, (item: EdgeDistanceData) => item.distance)!

  return { index: closestSegment.edgeIdx, position: closestSegment.pointOnEdge }
}
