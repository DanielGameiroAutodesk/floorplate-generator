import type { Line3, Vector2Like } from "three"
import { Vector2, Vector3 } from "three"

function determinant(vector1: Vector2Like, vector2: Vector2Like) {
  return vector1.x * vector2.y - vector1.y * vector2.x
}

export default function parametricLineIntersection(line1: Line3, line2: Line3): Vector2 | undefined {
  const line1Direction3d = line1.delta(new Vector3())
  const line2Direction3d = line2.delta(new Vector3())
  const line1Direction = new Vector2(line1Direction3d.x, line1Direction3d.y)
  const line2Direction = new Vector2(line2Direction3d.x, line2Direction3d.y)
  const normalizedDeterminant = determinant(line1Direction.clone().normalize(), line2Direction.normalize())
  if (Math.abs(normalizedDeterminant) < 0.001) {
    return undefined
  }

  const v1 = line1Direction.clone()
  const v2 = line2Direction.clone()
  const v3 = line2.start.clone().sub(line1.start)

  const d = determinant(v1, v2)
  const t = determinant(v3, v2) / d

  return new Vector2(line1.start.x, line1.start.y).add(line1Direction.multiplyScalar(t))
}
