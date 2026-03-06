import type { ClipboardValue } from "./types"
import { isDefined } from "src/lib/array"
import { copyPastePermissionErrorToast } from "./copyPasteErrorToasts"
import { getLeafKey, getParentPath } from "src/lib/element/path"
import invalid3dSketchOperationToast from "src/integrations/3dsketch/EditIn3DSketch/invalid3dSketchOperationToast"
import { parseUrn } from "src/lib/element/urn"
import { useMemo } from "preact/compat"
import { useCallback } from "preact/hooks"
import { is3DSketchBuildingFloorSelectedSignal } from "src/integrations/3dsketch/3dsketch-selection-state"
import { elementState } from "src/core/elements/ElementState"
import { getRegisteredElementSystem } from "src/core/element-systems"
import { selectedPathsInCurrentProposalAsArraySignal, selectionPathsSignal } from "src/core/selection/selectionState"
import { isCustomSelectionPath, parseCustomSelectionPath } from "src/core/selection/selectionTypes"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { CurrentLocation } from "src/lib/location"

export function useCanvasCopy() {
  // Coping individual 3D sketch floors is not supported
  const is3DSketchBuildingFloorSelected = is3DSketchBuildingFloorSelectedSignal.value

  const snapshot = elementState.currentSnapshot.value
  const selectedIds = selectedPathsInCurrentProposalAsArraySignal.value
  const selectionPaths = Array.from(selectionPathsSignal.value)

  const candidates = useMemo(() => {
    const elementCandidates = selectedIds
      .map((path): ClipboardValue | undefined => {
        const parentPath = getParentPath(path)
        if (!parentPath) return undefined

        const node = snapshot.getNode(path)
        if (!node) return undefined
        const urn = node.urn
        const parent = snapshot.getNode(parentPath)?.element
        const elementKey = getLeafKey(path)
        const child = parent?.children?.find((child) => child.key === elementKey)
        if (!child) return undefined
        const system = parseUrn(urn).system
        const elementSystem = getRegisteredElementSystem(system)
        if (elementSystem?.isSubSelectionElement && elementSystem?.isSubSelectionElement(node.element)) {
          // don't support copying subSelectionElements
          return undefined
        }

        return {
          urn: child.urn,
          name: child.name,
          transform: node.globalMatrix?.toArray(),
          category: node.element.properties?.category,
        }
      })
      .filter(isDefined)

    // Add terrain pads from custom selections
    const terrainPadCandidates = selectionPaths
      .filter(isCustomSelectionPath)
      .map(parseCustomSelectionPath)
      .filter(({ integration }) => integration === "terrain_pads")
      .map(({ id }): ClipboardValue | undefined => {
        const currentTerrain = elementState.currentTerrainSignal.peek()
        if (!currentTerrain) return undefined
        const operation = terrainApi.getTerrainOperation(currentTerrain.element, id)
        if (!operation) return undefined
        return { type: "terrain_pad" as const, operation }
      })
      .filter(isDefined)

    return [...elementCandidates, ...terrainPadCandidates]
  }, [selectedIds, selectionPaths, snapshot])

  const copy = useCallback(() => {
    if (is3DSketchBuildingFloorSelected) {
      invalid3dSketchOperationToast()
      console.warn("Coping individual 3D sketch floors is not supported - copying is ignored.")
      return
    }
    try {
      const copyData = { proposalId: CurrentLocation.getProposalId(), candidates }
      void navigator.clipboard.writeText(JSON.stringify(copyData))
    } catch (e) {
      copyPastePermissionErrorToast("copy", e)
    }
  }, [candidates, is3DSketchBuildingFloorSelected])

  return { candidates, copy }
}
