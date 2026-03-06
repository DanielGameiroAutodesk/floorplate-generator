import type { Frustum, OrthographicCamera } from "three"
import { Vector3 } from "three"

const tmpPoint = new Vector3()

const vecTopLeft = new Vector3()
const vecTopRight = new Vector3()
const vecDownRight = new Vector3()
const vecDownLeft = new Vector3()

const backTopLeft = new Vector3()
const backTopRight = new Vector3()
const backBottomLeft = new Vector3()

const nearToFarVector = new Vector3()
const cameraDirection = new Vector3(0, 0, -1)
const cameraDirectionReverse = new Vector3(0, 0, 1)

export function updateOrthographicFrustum(
  frustum: Frustum,
  camera: OrthographicCamera,
  startPoint: Vector3,
  endPoint: Vector3,
) {
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()

  tmpPoint.copy(startPoint)
  tmpPoint.x = Math.min(startPoint.x, endPoint.x)
  tmpPoint.y = Math.max(startPoint.y, endPoint.y)
  endPoint.x = Math.max(startPoint.x, endPoint.x)
  endPoint.y = Math.min(startPoint.y, endPoint.y)

  vecTopLeft.copy(tmpPoint)
  vecTopRight.set(endPoint.x, tmpPoint.y, 0)
  vecDownRight.copy(endPoint)
  vecDownLeft.set(tmpPoint.x, endPoint.y, 0)

  vecTopLeft.unproject(camera)
  vecTopRight.unproject(camera)
  vecDownRight.unproject(camera)
  vecDownLeft.unproject(camera)

  nearToFarVector
    .copy(cameraDirection)
    .normalize()
    .multiplyScalar(Math.abs(camera.far - camera.near))

  backTopLeft.copy(vecTopLeft).add(nearToFarVector)
  backTopRight.copy(vecTopRight).add(nearToFarVector)
  backBottomLeft.copy(vecDownLeft).add(nearToFarVector)

  let planes = frustum.planes

  planes[0].setFromCoplanarPoints(backTopLeft, vecTopRight, vecTopLeft) //Blue - Top
  planes[1].setFromCoplanarPoints(backTopRight, vecDownRight, vecTopRight) //Green - Right
  planes[2].setFromCoplanarPoints(vecDownRight, backBottomLeft, vecDownLeft) //Red - Bottom
  planes[3].setFromCoplanarPoints(vecDownLeft, backBottomLeft, vecTopLeft) //Cyan - Left
  planes[4].setFromNormalAndCoplanarPoint(cameraDirection, camera.position) //Pink - Near
  planes[5].setFromNormalAndCoplanarPoint(cameraDirectionReverse, backTopLeft) //Yellow - Far
}
