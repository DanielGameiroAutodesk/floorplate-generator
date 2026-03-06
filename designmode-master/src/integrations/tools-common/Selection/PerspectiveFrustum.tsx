import type { Frustum, PerspectiveCamera } from "three"
import { Vector3 } from "three"

const tmpPoint = new Vector3()

const cameraPosition = new Vector3()
const vecTopLeft = new Vector3()
const vecTopRight = new Vector3()
const vecDownRight = new Vector3()
const vecDownLeft = new Vector3()

const backTopLeft = new Vector3()
const backTopRight = new Vector3()
const backDownRight = new Vector3()

const cameraDirection = new Vector3()

export function updatePerspectiveFrustum(
  frustum: Frustum,
  camera: PerspectiveCamera,
  startPoint: Vector3,
  endPoint: Vector3,
) {
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  camera.getWorldDirection(cameraDirection)

  tmpPoint.copy(startPoint)
  tmpPoint.x = Math.min(startPoint.x, endPoint.x)
  tmpPoint.y = Math.max(startPoint.y, endPoint.y)
  endPoint.x = Math.max(startPoint.x, endPoint.x)
  endPoint.y = Math.min(startPoint.y, endPoint.y)

  cameraPosition.copy(camera.position)
  vecTopLeft.copy(tmpPoint)
  vecTopRight.set(endPoint.x, tmpPoint.y, 0)
  vecDownRight.copy(endPoint)
  vecDownLeft.set(tmpPoint.x, endPoint.y, 0)

  vecTopLeft.unproject(camera)
  vecTopRight.unproject(camera)
  vecDownRight.unproject(camera)
  vecDownLeft.unproject(camera)

  backTopLeft.copy(vecTopLeft).sub(cameraPosition)
  backTopRight.copy(vecTopRight).sub(cameraPosition)
  backDownRight.copy(vecDownRight).sub(cameraPosition)
  backTopLeft.normalize()
  backTopRight.normalize()
  backDownRight.normalize()

  backTopLeft.multiplyScalar(camera.far)
  backTopRight.multiplyScalar(camera.far)
  backDownRight.multiplyScalar(camera.far)
  backTopLeft.add(cameraPosition)
  backTopRight.add(cameraPosition)
  backDownRight.add(cameraPosition)

  let planes = frustum.planes

  planes[0].setFromCoplanarPoints(cameraPosition, vecTopLeft, vecTopRight) //Blue - Top
  planes[1].setFromCoplanarPoints(cameraPosition, vecTopRight, vecDownRight) //Green - Right
  planes[2].setFromCoplanarPoints(vecDownRight, vecDownLeft, cameraPosition) //Red - Bottom
  planes[3].setFromCoplanarPoints(vecDownLeft, vecTopLeft, cameraPosition) //Cyan - Left
  planes[4].setFromNormalAndCoplanarPoint(cameraDirection, vecTopLeft) //Pink - Near
  planes[5].setFromNormalAndCoplanarPoint(cameraDirection.multiplyScalar(-1), backTopLeft) //Yellow - Far
}
