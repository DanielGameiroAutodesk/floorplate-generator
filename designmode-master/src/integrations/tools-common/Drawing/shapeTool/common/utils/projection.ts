import type { Object3D } from "three"
import { Raycaster, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import "three-mesh-bvh"

const raycaster = new Raycaster()

declare module "three" {
  export interface Raycaster {
    // firstHitOnly is used by three-mesh-bvh. See https://github.com/gkjohnson/three-mesh-bvh
    firstHitOnly?: boolean
  }
}

raycaster.firstHitOnly = true

export function projectPositionToSurface(
  original: Vector3,
  surface?: Object3D,
  projected: Vector3 = new Vector3(),
): Vector3 {
  projected.copy(original)

  if (!surface) {
    return projected
  }
  raycaster.set(original.clone().setZ(-1000), new Vector3(0, 0, 1))
  let intersections = raycaster.intersectObject(surface)
  if (intersections && intersections.length > 0) {
    projected.copy(intersections[0].point)
  }
  return projected
}

/** @deprecated uses slow 3d raycast, see 2d-raytracer.ts */
export function projectPositionToTerrain(original: Vector3, target = new Vector3()) {
  const terrain = sceneManager.scene.getObjectByName("Terrain")
  if (!terrain) throw new Error("Terrain not available for projection")

  return projectPositionToSurface(original, terrain, target)
}
