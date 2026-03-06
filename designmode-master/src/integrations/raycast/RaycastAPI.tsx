import { mousePosition } from "src/core/useMousePosition"
import sceneManager from "src/core/three/sceneManager"
import type { CandidateLine } from "src/integrations/snapping/snappingEngine"
import { pickLineSegment } from "src/integrations/snapping/snappingEngine"
import { toolSnappingLinesCandidatesSignal } from "src/integrations/snapping/snappingPicker.state"
import { Raycaster, Vector2, Vector3 } from "three"
import { bboxOctreeSnappingLinesSignal } from "src/integrations/snapping/bboxOctreeSnappingLines"
import { elementState } from "src/core/elements/ElementState"
import { getVisibleNodesSignal } from "src/core/elements/predicates"
import { getRaycastableMeshesForVisibleNodesSignal } from "src/core/elements/child-node-container-derived-data/volumeMeshWithAcceleratedRaycast"
import { isDefined } from "src/lib/array"

type Vec3 = { x: number; y: number; z: number }
type raycastResult =
  | {
      position: Vec3
      normal?: Vec3
      onTerrain: boolean
    }
  | undefined

type RaycastTerrainResult = {
  position: Vec3
  normal?: Vec3
}

/**
 * API for raycasting into the scene
 */
export interface RaycastAPI {
  /**
   * Casts a ray at the current mouse position.
   * @return the position and normal of the ray intersection closest to the camera, as well as a flag for whether the intersected object was the terrain. Undefined if no intersection.
   */
  raycastMousePosition(): raycastResult
  /**
   * Casts a ray at the current mouse position and returns the intersection with the terrain.
   * @return the position and normal of the ray intersection closest to the camera. Undefined if no intersection.
   */
  raycastTerrain(): RaycastTerrainResult | undefined

  /**
   * Casts a ray at the given screen coordinates.
   * @param screenCoordinates
   */
  raycast(screenCoordinates: { x: number; y: number }): raycastResult

  snapping: {
    /** Gives you all the lines within the current snapping threshold
     * Will be changed to not use Threejs */
    getLinesAtMousePosition_UNSTABLE(): CandidateLine[]
  }
}

const reusableRaycaster = new Raycaster()

function getLinesAtMousePosition() {
  return pickLineSegment(
    mousePosition,
    getRaycastableMeshesForVisibleNodesSignal.peek()(),
    bboxOctreeSnappingLinesSignal.peek(),
    toolSnappingLinesCandidatesSignal.peek(),
    undefined,
    undefined,
    false,
  )
}

function raycastScene(raycaster: Raycaster) {
  const proposal = elementState.currentProposalSignal.peek()
  const meshes = getVisibleNodesSignal
    .peek()(proposal)
    .filter((node) => node.elementContainer !== proposal.terrain?.container)
    .map((node) => node.volumeMeshWithAcceleratedRaycast.getOrCompute())
    .filter(isDefined)

  const terrain = sceneManager.scene.getObjectByName("Terrain")
  const targets = terrain ? [terrain, ...meshes] : meshes
  let intersections = []
  try {
    intersections = raycaster.intersectObjects(targets)
  } catch (e) {
    console.error("Failed to raycast against targets for some reason. Bug in three?")
    console.log(targets)
    throw e
  }
  if (!intersections.length) return

  const first = intersections[0]

  // Get normal at hit point using object world transform
  let normal = first.face?.normal
  if (normal) {
    const origin = new Vector3(0, 0, 0).applyMatrix4(first.object.matrixWorld)
    normal.applyMatrix4(first.object.matrixWorld).sub(origin)
  }

  return {
    position: first.point,
    normal: normal,
    onTerrain: first.object === terrain,
  }
}

function raycastMousePosition() {
  return raycastScene(mousePosition)
}

function raycast(screenCoordinates: { x: number; y: number }) {
  const ndcX = (screenCoordinates.x / sceneManager.canvas.clientWidth) * 2 - 1
  const ndcY = (screenCoordinates.y / sceneManager.canvas.clientHeight) * 2 - 1
  reusableRaycaster.setFromCamera(new Vector2(ndcX, ndcY), sceneManager.camera)
  return raycastScene(reusableRaycaster)
}

function raycastTerrain(): RaycastTerrainResult | undefined {
  const terrain = sceneManager.scene.getObjectByName("Terrain")
  const intersections = mousePosition.intersectObject(terrain!)
  if (intersections.length > 0) {
    const first = intersections[0]
    return {
      position: first.point,
      normal: first.face?.normal,
    }
  }
}

export const raycastApi: RaycastAPI = {
  raycastMousePosition,
  raycastTerrain,
  raycast,
  snapping: {
    getLinesAtMousePosition_UNSTABLE: getLinesAtMousePosition,
  },
}

/** Will be changed to not use Threejs */
export type { SnappingLine as SnappingLine_UNSTABLE } from "src/integrations/snapping/snapping"
