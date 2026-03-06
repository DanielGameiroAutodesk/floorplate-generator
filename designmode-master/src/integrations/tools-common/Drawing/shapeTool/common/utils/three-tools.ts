import type { Object3D } from "three"
import { OrthographicCamera, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import type { CandidateLine } from "src/integrations/snapping/snappingEngine"
import { mousePosition } from "src/core/useMousePosition"

function findOccludingObjects(objects: Object3D[]): Object3D[] {
  return objects
    .flatMap((obj) => {
      const occludes = obj.userData?.occludesSnapping
      if (occludes) return obj
      if (obj.children.length) {
        return findOccludingObjects(obj.children)
      }
    })
    .filter((o?: Object3D): o is Object3D => !!o)
}

const reusableVector = new Vector3()
const errorMargin = 0.01
export function filterOccluded(candidateLines: CandidateLine[], raycastingTargets: Object3D[]): CandidateLine[] {
  if (sceneManager.camera instanceof OrthographicCamera) return candidateLines

  const movegroup = findOccludingObjects(sceneManager.scene.children)
  const targets = [...raycastingTargets, ...movegroup]
  const intersections = mousePosition
    .intersectObjects(targets, true)
    .filter((i) => i.object.name !== "Terrain" && i.object.type === "Mesh")

  if (intersections.length === 0) return candidateLines
  const closestIntersection = intersections[0].distance

  return candidateLines.filter((line) => {
    const dist = reusableVector.subVectors(line.position, sceneManager.camera.position).length()
    return closestIntersection > dist - dist * errorMargin
  })
}
