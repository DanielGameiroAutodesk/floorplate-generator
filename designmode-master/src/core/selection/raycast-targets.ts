import { computed } from "@preact/signals"
import type { ChildNodeSelectable } from "src/core/elements/child-node-container-derived-data/selectables"
import { getSelectablesForToplevelNode } from "src/core/elements/child-node-container-derived-data/selectables"
import { elementState } from "src/core/elements/ElementState"
import { getRaycastableToplevelNodesSignal } from "src/core/elements/predicates"
import sceneManager from "src/core/three/sceneManager"
import { type Object3D } from "three"
import { getTargetPath, type RaycastData } from "./raycasting"
import { elementSelectionPathToInternalPath, isElementSelectionPath } from "./selectionTypes"
import type { InternalPath } from "src/lib/element/path"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export function getHoveredPathFromMouseEvent(e: MouseEvent): InternalPath | undefined {
  const data = getTargetPath(e, sceneManager.camera, raycastTargetsSignal.peek())
  const selectionPath = data?.selection
  if (!selectionPath || !isElementSelectionPath(selectionPath)) return undefined
  return elementSelectionPathToInternalPath(selectionPath)
}

function selectableToRaycastTargets(selectable: ChildNodeSelectable): [Object3D, RaycastData][] {
  return selectable.raycastTargets.map((raycastTarget): [Object3D, RaycastData] => {
    const raycastData: RaycastData = {
      raycastType: raycastTarget.type,
      selection: selectable.selectionPath,
    }
    return [raycastTarget.object3d, raycastData]
  })
}

export const raycastTargetsSignal = computed<Map<Object3D, RaycastData>>(() => {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  const getRaycastableNodes = getRaycastableToplevelNodesSignal.value

  const elementTargets = getRaycastableNodes(proposal).flatMap((node): [Object3D, RaycastData][] =>
    getSelectablesForToplevelNode(node, proposal, terrain).flatMap(selectableToRaycastTargets),
  )

  return new Map([...elementTargets])
})
