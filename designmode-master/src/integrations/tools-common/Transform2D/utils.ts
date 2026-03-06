import type { Feature, GeoJsonProperties, Geometry } from "geojson"
import { Matrix4, Vector3 } from "three"
import { type PrepassData, raycast } from "src/core/terrain/2d-raytracer"
import type { Segment } from "src/lib/geometry/geometryTypes"

const reusableVector = new Vector3()

export function createDiagonalLine(
  geojson: Feature<Geometry, GeoJsonProperties>,
  worldMatrix: Matrix4,
  terrain: PrepassData,
): Segment | undefined {
  if (geojson.geometry.type !== "Polygon") return
  return [geojson.geometry.coordinates[0][0], geojson.geometry.coordinates[0][2]].map(([x, y]) => {
    reusableVector.set(x, y, 0).applyMatrix4(worldMatrix)
    return reusableVector.setZ(raycast(reusableVector.x, reusableVector.y, terrain)).toArray()
  }) as Segment
}

/**
 * Creates a transform matrix that transforms the original line segment to the updated line segment.
 */
export function createTransformFromLineSegments(updatedLineSegment: Segment, lineSegment: Segment) {
  const points = updatedLineSegment.map((p) => new Vector3().fromArray(p))
  const originalPoints = lineSegment.map((p) => new Vector3().fromArray(p))

  const originalVector = new Vector3().subVectors(originalPoints[1], originalPoints[0]).setZ(0)
  const newVector = new Vector3().subVectors(points[1], points[0]).setZ(0)

  const originalDistance = originalVector.length()
  const newDistance = newVector.length()
  const scale = newDistance / originalDistance

  const angle = originalVector.angleTo(newVector) * Math.sign(originalVector.cross(newVector).z)

  const moveToOrigo = new Matrix4().makeTranslation(-originalPoints[0].x, -originalPoints[0].y, 0)
  const moveFromOrigo = new Matrix4().makeTranslation(points[0].x, points[0].y, 0)

  const matrix = new Matrix4()

  const scaleMatrix = new Matrix4().makeScale(scale, scale, 1)
  const rotateMatrix = new Matrix4().makeRotationZ(angle)

  matrix.multiply(moveFromOrigo).multiply(scaleMatrix).multiply(rotateMatrix).multiply(moveToOrigo)
  return matrix
}
