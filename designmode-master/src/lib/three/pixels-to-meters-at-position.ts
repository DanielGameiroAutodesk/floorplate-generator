import type { Camera } from "three"
import { Vector3 } from "three"

const _vec3a = new Vector3()
const _vec3b = new Vector3()

export function pixelsToMetersAtPosition(pixels: number, camera: Camera, referencePosition: Vector3): number {
  const hundredPixelHeightNormalized = 100 / (window.innerHeight / 2)
  const metersPerPixel =
    _vec3a
      .copy(referencePosition)
      .project(camera)
      .add(_vec3b.set(0, hundredPixelHeightNormalized, 0))
      .unproject(camera)
      .distanceTo(referencePosition) / 100

  return metersPerPixel * pixels
}
