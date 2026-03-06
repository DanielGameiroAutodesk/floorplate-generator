import { getVisibleNodesSignal } from "src/core/elements/predicates"
import { elementState } from "src/core/elements/ElementState"
import { useSignalEffect } from "@preact/signals"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { isDefined } from "src/lib/array"
import sceneManager from "src/core/three/sceneManager"
import { showTerrainSignal } from "src/core/terrain/terrain-state"
import type { Object3D } from "three"
import { isI3dsFocusModeActiveSignal } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"

export function useUpdateRaycastingTargetsList() {
  useSignalEffect(() => {
    if (!isAppInitializedSignal.value) return

    const getVisibleNodes = getVisibleNodesSignal.value
    const proposal = elementState.currentProposalSignal.value
    const terrainVisible = showTerrainSignal.value
    const isWSRContextHidden = isI3dsFocusModeActiveSignal.value //This is to handle the case when WSR context is hidden in 3DSketch

    let targetList: Object3D[] = isWSRContextHidden
      ? []
      : getVisibleNodes(proposal)
          .map((node) => node.volumeMeshWithAcceleratedRaycast.getOrCompute())
          .filter(isDefined)

    if (terrainVisible && !isWSRContextHidden) {
      const terrain = sceneManager.scene.getObjectByName("Terrain")
      if (terrain) {
        // When terrain is visible, and available, add it to the list of raycast targets
        targetList = [...targetList, terrain]
      }
    }

    // Look for wsrInstanceRoot object in the scene, used in 3DSketch
    const wsmObjects = sceneManager.scene.getObjectByName("wsrInstanceRoot")
    if (wsmObjects) {
      // If wsmObjects is present, add it to the list of raycast targets
      targetList = [...targetList, wsmObjects]
    }

    if (!targetList.length) return

    const old = sceneManager.controls.raycastTargetsList.state
    sceneManager.controls.raycastTargetsList.state = targetList

    return () => {
      sceneManager.controls.raycastTargetsList.state = old
    }
  })

  return null
}
