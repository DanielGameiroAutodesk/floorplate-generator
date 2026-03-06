import { useCallback } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { selectedTopLevelNodesSignal } from "src/core/selection/selectionState"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import {
  isConstraintElement,
  isElementProviderNot3dsEditable,
  isIntegrateElement,
} from "src/integrations/tools-common/Selection/editElement"
import type { InternalPath } from "src/lib/element/path"
import { isBasicElementUrn, parseUrn } from "src/lib/element/urn"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"
import {
  is3DSketchBuildingFloor,
  is3dSketchElement,
  isConvertibleImportElement,
  isConvertibleMeshElement,
  isElementConvertibleIn3DSketchSignal,
  isElementEditableIn3DSketchWithCheckSignal,
  isImportElement,
} from "./3dsketch-selection-state"
import { useIsJustBuildingsSelected } from "./useEditIn3DSketch"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"

export function useCanEditIn3dSketch() {
  const editAllIntegrate = useFeatureFlag(URLFlag.EditAllIntegrate)
  const snapshot = elementState.currentSnapshot.value
  return useCallback(
    (node: ChildNodeContainer) => {
      // We don't have support for polygons yet!
      if (areFootprintsSelected(node)) return false

      const is3DSketchElementSelected = is3dSketchElement(node.element)
      const is3dSketchElementFloorSelected = is3DSketchBuildingFloor(node, snapshot)
      const isIntegrateOrConvertible = editAllIntegrate
        ? parseUrn(node.urn).system === "integrate"
        : isConvertibleMeshElement(node.element)

      return is3DSketchElementSelected || is3dSketchElementFloorSelected || isIntegrateOrConvertible
    },
    [editAllIntegrate, snapshot],
  )
}

export function useCanConvertTo3dSketch() {
  // When not checking single element
  const isElementEditableIn3DSketch = isElementEditableIn3DSketchWithCheckSignal.value
  const isElementConvertibleIn3DSketch = isElementConvertibleIn3DSketchSignal.value
  const isBuildingsSelected = useIsJustBuildingsSelected()

  return useCallback((): boolean => {
    return !isElementEditableIn3DSketch && (isElementConvertibleIn3DSketch || isBuildingsSelected)
  }, [isBuildingsSelected, isElementConvertibleIn3DSketch, isElementEditableIn3DSketch])
}

export function areFootprintsSelected(node: ChildNodeContainer) {
  // Check if the selected element has a footprint itself or its children
  const areFootprintsSelected =
    node.element.representations?.footprint !== undefined ||
    node.elementContainer.children.some((child) => child.element.representations?.footprint !== undefined)
  return !!areFootprintsSelected
}

export function useShouldEditInIntegrated3dSketch() {
  const proposal = elementState.currentProposalSignal.value
  const selected = selectedTopLevelNodesSignal.value

  return useCallback(
    (useNode?: ChildNodeContainer): boolean => {
      function canEditInIntegrated3dSketchInternal(node: ChildNodeContainer) {
        // Always allow editing of 3d sketch elements
        if (is3dSketchElement(node.element)) return true
        // Don't allow blacklisted element providers into 3d sketch
        if (isElementProviderNot3dsEditable(node.element)) return false
        const isConstraint = isConstraintElement(node.element)

        // Note: Previously we checked for element.representations?.volumeMesh,
        //       but this had incorrect behavior in that sometimes the element
        //       wasn't completely populated with representations by the time
        //       we went to edit it. getVolumeMesh doesn't have this issue.
        const hasVolumeMesh = !!getVolumeMeshWithTerrainFallback(proposal, node.urn)
        const isGenericVolume = node.element.properties?.category === "generic" && hasVolumeMesh

        // an element is also a generic volume we want to edit in 3DS if it is of the "basic" element
        // system and is of category "building". This is because LoD1 contextual buildings are stored
        // in the "basic" element system and with a category of "building".
        const isContextBuilding =
          !isGenericVolume && isBasicElementUrn(node.urn) && node.element.properties?.category === "building"

        // Check if the element is a integrate element with a volume mesh (Tinkercad)
        const isIntegrateVolumeMesh = isIntegrateElement(node.element) && hasVolumeMesh

        // 3d sketch element
        const formats: string[] = node.element.properties?.spacemakerObjectStorageReferenceFormats || []
        const isWSMOrAXM = formats.includes("wsm") || formats.includes("axm")

        const isBuildingFloor = is3DSketchBuildingFloor(node, proposal.snapshot)

        // Standard library import
        const isImport = isImportElement(node.element) && !!node.element.children?.length

        // Don't allow direct editing of imports that need to be converted
        if (isConvertibleImportElement(node.element)) return false

        return (
          isWSMOrAXM ||
          isConstraint ||
          isGenericVolume ||
          isBuildingFloor ||
          isImport ||
          isContextBuilding ||
          isIntegrateVolumeMesh
        )
      }

      if (useNode) return canEditInIntegrated3dSketchInternal(useNode)

      if (selected.length === 0) return false
      const node = selected[0]
      return canEditInIntegrated3dSketchInternal(node)
    },
    [proposal, selected],
  )
}

function useShouldBeEditedIn3DSketch() {
  const canEditInIntegrated3dSketch = useShouldEditInIntegrated3dSketch()
  const snapshot = elementState.currentSnapshot.value

  return useCallback(
    (path: InternalPath): boolean => {
      const node = snapshot.getNode(path)
      if (!node) return false
      return canEditInIntegrated3dSketch(node)
    },
    [canEditInIntegrated3dSketch, snapshot],
  )
}

export default useShouldBeEditedIn3DSketch
