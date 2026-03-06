import { useIsPathTo3dSketchFloor } from "src/integrations/conceptual-squad/conceptualElementsApi"
import type { Action } from "src/core/legacy-actions"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { is3DSketchBuildingFloorSelectedSignal } from "src/integrations/3dsketch/3dsketch-selection-state"
import { selectedBasePathsInProposalContextSignal, selectionPathsSignal } from "src/core/selection/selectionState"
import type { TrackingData } from "src/core/analytics"
import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { FormaElement } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import { useCallback } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { getRegisteredElementSystem } from "src/core/element-systems"
import {
  elementSelectionPathToInternalPath,
  isCustomSelectionPath,
  isElementSelectionPath,
} from "src/core/selection/selectionTypes"
import { recoveryClear } from "src/integrations/wsm-tools/wsr/recovery"
import invalid3dSketchOperationToast from "src/integrations/3dsketch/EditIn3DSketch/invalid3dSketchOperationToast"
import { deleteCustomEntities } from "./deleteCustomEntity"
import { dispatchDeleteEvents } from "./dispatchDeleteEvents"

function getPathsBySystem(paths: string[], getElementByPath: (path: string) => FormaElement | undefined) {
  const pathsBySystem: Record<string, string[]> = {}
  for (const path of paths) {
    const element = getElementByPath(path)
    const system = element?.urn && parseUrn(element.urn).system
    if (!system) continue
    if (!pathsBySystem[system]) {
      pathsBySystem[system] = []
    }
    pathsBySystem[system].push(path)
  }

  return pathsBySystem
}

export function useDeleteSelected() {
  const isId3DSketchFloor = useIsPathTo3dSketchFloor()
  const actionAPI = useActionAPI()

  return useCallback((): Action[] | undefined => {
    const snapshot = elementState.currentSnapshot.peek()
    const cantEdit = canEditProposalSignal.peek()

    const is3DSketchBuildingFloorSelected = is3DSketchBuildingFloorSelectedSignal.peek()
    const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.peek()

    if (selectedBasePathsInProposalContext.size > 0) {
      console.warn("Deleting elements base elements while in proposal context - deleting is ignored.")
      return
    }

    if (!cantEdit) {
      console.warn("Deleting elements while in view-only mode - deleting is ignored.")
      return
    }

    if (is3DSketchBuildingFloorSelected) {
      invalid3dSketchOperationToast()
      console.warn("Deleting individuals 3d sketch floors is not supported - deleting is ignored.")
    }

    const currentSelectionPaths = Array.from(selectionPathsSignal.peek())

    const customSelectionPaths = currentSelectionPaths.filter(isCustomSelectionPath)
    deleteCustomEntities(customSelectionPaths)

    const selectedElementPaths = currentSelectionPaths
      .filter(isElementSelectionPath)
      .map(elementSelectionPathToInternalPath)

    // 3D Sketch building floors are not meant to be deleted by the user
    const idsFor3DSketchFloorsToPreserve = selectedElementPaths.filter((elementPath) => isId3DSketchFloor(elementPath))
    const partialTrackingInfo = partialTrackingDataForSelectionSignal.peek()
    const trackingData: TrackingData = {
      ...partialTrackingInfo,
      tool: "delete",
      eventType: "delete",
    }

    const actions: Action[] = []
    const nonExceptionPaths = selectedElementPaths.filter((id) => !idsFor3DSketchFloorsToPreserve.includes(id))
    const pathsBySystem = getPathsBySystem(nonExceptionPaths, (path) => snapshot.getNode(path)?.element)
    for (const [system, paths] of Object.entries(pathsBySystem)) {
      const elementSystem = getRegisteredElementSystem(system)
      if (elementSystem?.deletePaths) {
        actions.push(...elementSystem.deletePaths(paths, snapshot))
      } else {
        actions.push(...paths.map((path): Action => ({ type: "delete", path })))
      }
    }

    if (actions.length === 0) return undefined

    // Delete paths from 3ds recovery
    nonExceptionPaths.forEach((path) => void recoveryClear(false, path))

    actionAPI.apply(
      "Delete",
      actions,
      trackingData,
      idsFor3DSketchFloorsToPreserve.length > 0 ? new Set(idsFor3DSketchFloorsToPreserve) : new Set(),
    )

    // Dispatch delete events
    dispatchDeleteEvents(snapshot, nonExceptionPaths)
  }, [isId3DSketchFloor, actionAPI])
}
