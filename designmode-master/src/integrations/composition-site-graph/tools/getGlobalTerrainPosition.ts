import type { Matrix4 } from "three"
import { Vector3 } from "three"

export function getGlobalTerrainPosition(
  vec: { x: number; y: number },
  transform: Matrix4,
  getElevation: (x: number, y: number) => number,
) {
  const localVec = new Vector3(vec.x, vec.y, 0)
  localVec.applyMatrix4(transform)
  localVec.z = getElevation(localVec.x, localVec.y)
  return localVec
}

export function getElevationInLocalCoordinateSystem(
  vec: { x: number; y: number },
  transform: Matrix4,
  getElevation: (x: number, y: number) => number,
) {
  const localVec = new Vector3(vec.x, vec.y, 0)
  const globalVec = localVec.clone().applyMatrix4(transform)
  globalVec.z = getElevation(globalVec.x, globalVec.y)
  const localVec2 = globalVec.clone().applyMatrix4(transform.clone().invert())
  return localVec2.z
}
