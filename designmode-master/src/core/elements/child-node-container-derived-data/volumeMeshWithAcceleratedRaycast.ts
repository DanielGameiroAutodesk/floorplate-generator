import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { Object3D } from "three"
import { Mesh } from "three"
import { acceleratedRaycast } from "three-mesh-bvh"
import { elementState } from "src/core/elements/ElementState"
import { getVisibleNodesSignal } from "src/core/elements/predicates"
import { computed } from "@preact/signals"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { isDefined } from "src/lib/array"

export const volumeMeshWithAcceleratedRaycastController = createDerivedDataController(
  computeVolumeMeshWithAcceleratedRaycast,
)

function computeVolumeMeshWithAcceleratedRaycast(node: ChildNodeContainer): Mesh | undefined {
  const volumeMesh = node.elementContainer.volumeMeshWithBoundsTree.getOrCompute()
  if (!volumeMesh) return undefined

  const mesh = new Mesh(volumeMesh)
  mesh.raycast = acceleratedRaycast
  mesh.applyMatrix4(node.globalMatrix)
  mesh.updateMatrixWorld()
  return mesh
}

/**
 * Get accelerated (raycastable) meshes for all visible, possibly non-virtual, elements in the current
 * snapshot. This is used e.g. to filter out snapping hits that are hidden/occluded behind geometry
 *
 * @param {boolean} ignoreVirtualNodes Whether to ignore/leave out meshes from "virtual" toplevel objects
 */
export const getRaycastableMeshesForVisibleNodesSignal = computed(() => {
  const proposal = elementState.currentProposalSignal.value
  const getVisibleNodes = getVisibleNodesSignal.value

  return (options?: { ignoreVirtualNodes: boolean }): Object3D[] =>
    getVisibleNodes(proposal, options)
      .map((node) => node.volumeMeshWithAcceleratedRaycast.getOrCompute())
      .filter(isDefined)
})
