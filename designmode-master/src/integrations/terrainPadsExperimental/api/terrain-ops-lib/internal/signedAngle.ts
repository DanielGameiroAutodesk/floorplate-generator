import { Plane, Vector3 } from "three"

function getNormal(u: Vector3, v: Vector3): Vector3 {
  return new Plane().setFromCoplanarPoints(new Vector3(), u, v).normal
}

export function signedAngleTo(u: Vector3, v: Vector3): number {
  // Get the signed angle between u and v, in the range [-pi, pi]
  const angle = u.angleTo(v)
  const normal = getNormal(u, v)
  return normal.z * angle
}
