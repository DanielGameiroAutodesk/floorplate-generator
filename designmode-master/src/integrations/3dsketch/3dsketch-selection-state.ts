import { isBasicElementUrn, parseUrn } from "src/lib/element/urn"
import { selectedNodesSignal, selectedTopLevelNodesSignal, selectionSetSignal } from "src/core/selection/selectionState"
import type { FormaElement } from "@spacemakerai/element-types"
import { URLFlag, featureFlagSignalFamily } from "src/lib/featureToggling"
import { areFootprintsSelected } from "./useShouldBeEditedIn3DSketch"
import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { ElementKeyPath } from "src/lib/element/path"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { contextualDataApi } from "src/integrations/contextual-data/api"
import { isElementProviderNot3dsEditable } from "src/integrations/tools-common/Selection/editElement"

export function is3dSketchElement(element?: FormaElement, includeConstraints: boolean = false) {
  if (!element || !element.properties) return false

  const { spacemakerObjectStorageReferenceFormats } = element.properties
  if (!spacemakerObjectStorageReferenceFormats) return false

  // We don't want to edit constraints in integrated nor classic 3d sketch.
  if (!includeConstraints && element.properties.category === "constraints") return false

  // Ignore certain imports
  if (element.properties.elementProvider == "Rhino" && !spacemakerObjectStorageReferenceFormats.includes("axm"))
    return false

  return spacemakerObjectStorageReferenceFormats.includes("axm")
}

export function is3dSketchElementGeneric(element?: FormaElement) {
  if (!element || !element.properties || !is3dSketchElement(element)) return false

  return element.properties?.category === "generic" || !element.properties?.category
}

export const areFootprintsSelectedSignal = computed<boolean>(() => {
  const selection = selectedTopLevelNodesSignal.value
  if (selection.length !== 1) return false

  const node = selection[0]

  if (!node) {
    return false
  }

  return areFootprintsSelected(node)
})

export const isImportElement = (element: FormaElement) => {
  return ["imports-system", "import-service"].includes(element.properties?.elementProvider)
}

export const isConvertibleMeshElement = (element: FormaElement) => {
  const isDynamoMesh = element.properties?.elementProvider === "dynamo-player"
  const isLoD2ContextualMesh = contextualDataApi.isLoD2Building(element)
  const isLoD1ContextualMesh = isBasicElementUrn(element.urn) && element.properties?.category === "building"
  return isImportElement(element) || isDynamoMesh || isLoD2ContextualMesh || isLoD1ContextualMesh
}

// Checks whether import element needs to convert (warn user) to be editable in 3d sketch
// and not just editable using double click. Right now this only includes Rhino imports
export const isConvertibleImportElement = (element: FormaElement) => {
  const isRhino =
    element.properties?.elementProvider === "Rhino" &&
    element.properties?.category !== "constraints" &&
    !element.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm")
  return isRhino
}

export const isConvertibleMeshElementSelectedSignal = computed<boolean>(() => {
  const selection = selectedTopLevelNodesSignal.value
  if (selection.length !== 1) return false

  const element = selection[0].elementContainer.element

  return isConvertibleMeshElement(element)
})

export const isConvertibleImportElementSelectedSignal = computed<boolean>(() => {
  const selection = selectedTopLevelNodesSignal.value
  if (selection.length !== 1) return false

  const element = selection[0].elementContainer.element

  return isConvertibleImportElement(element)
})

//Intermediate solution here is to support editing of all integrate elements.
export const isIntegrateElementSelectedSignal = computed<boolean>(() => {
  const selection = selectedTopLevelNodesSignal.value
  if (selection.length !== 1) return false

  const element = selection[0].elementContainer.element

  return parseUrn(element.urn).system === "integrate"
})

// Signal to check if the selected element is an integrate element that is editable in 3D sketch
// (Not Revit or Rhino)
export const isIntegrateElementProvider3dsEditableSelectedSignal = computed<boolean>(() => {
  const selection = selectedTopLevelNodesSignal.value
  if (selection.length !== 1) return false

  const element = selection[0].elementContainer.element

  return (
    isIntegrateElementSelectedSignal.value &&
    element.representations?.volumeMesh !== undefined &&
    !isElementProviderNot3dsEditable(element)
  )
})

export const isElementConvertibleIn3DSketchSignal = computed<boolean>(() => {
  const selection = selectionSetSignal.value
  const isConvertibleMeshElementSelected = isConvertibleMeshElementSelectedSignal.value
  const is3DSketchElementSelected = is3dSketchElementSelectedSignal.value
  const isConvertibleImportElementSelected = isConvertibleImportElementSelectedSignal.value

  return (
    (is3DSketchElementSelected || isConvertibleMeshElementSelected || isConvertibleImportElementSelected) &&
    selection.size === 1
  )
})

export const is3dSketchElementSelectedSignal = computed<boolean>(() => {
  const selected = selectedTopLevelNodesSignal.value
  if (selected.length !== 1) return false
  const { element } = selected[0].elementContainer

  return is3dSketchElement(element)
})

export const is3dSketchConstraintSelectedSignal = computed<boolean>(() => {
  const selected = selectedTopLevelNodesSignal.value
  if (selected.length !== 1) return false
  const { element } = selected[0].elementContainer

  return is3dSketchElement(element, true)
})

export const isSingle3dSketchBuildingSelectedSignal = computed<boolean>(() => {
  const selected = selectedTopLevelNodesSignal.value
  if (selected.length === 0) return false
  const is3dSketchElementSelected = is3dSketchElementSelectedSignal.value

  const element = selected[0].elementContainer.element

  return is3dSketchElementSelected && element.properties?.category === "building"
})

//For now, used when editAllIntegrate ff is set.
export const isElementEditableIn3DSketchWithIntegratedCheckSignal = computed<boolean>(() => {
  const is3DSketchElementSelected = is3dSketchElementSelectedSignal.value
  const isIntegrateElementSelected = isIntegrateElementSelectedSignal.value
  const areFootprintsSelected = areFootprintsSelectedSignal.value
  const is3dSketchElementFloorSelected = is3DSketchBuildingFloorSelectedSignal.value

  // We don't have support for polygons yet!
  if (areFootprintsSelected) return false

  return is3DSketchElementSelected || isIntegrateElementSelected || is3dSketchElementFloorSelected
})

export const isElementEditableIn3DSketchSignal = computed<boolean>(() => {
  const is3DSketchElementSelected = is3dSketchElementSelectedSignal.value
  const isConvertibleMeshElementSelected = isConvertibleMeshElementSelectedSignal.value
  const areFootprintsSelected = areFootprintsSelectedSignal.value
  const is3dSketchElementFloorSelected = is3DSketchBuildingFloorSelectedSignal.value
  const isIntegrateElementProvider3dsEditableSelected = isIntegrateElementProvider3dsEditableSelectedSignal.value

  // We don't have support for polygons yet!
  if (areFootprintsSelected) return false

  return (
    is3DSketchElementSelected ||
    isConvertibleMeshElementSelected ||
    is3dSketchElementFloorSelected ||
    isIntegrateElementProvider3dsEditableSelected
  )
})

export const isElementEditableIn3DSketchWithCheckSignal = computed<boolean>(() => {
  const editAllIntegrate = featureFlagSignalFamily(URLFlag.EditAllIntegrate).value
  const isElementEditableWithIntegratedCheck = isElementEditableIn3DSketchWithIntegratedCheckSignal.value
  const isElementEditableWithCurrentCheck = isElementEditableIn3DSketchSignal.value
  return editAllIntegrate ? isElementEditableWithIntegratedCheck : isElementEditableWithCurrentCheck
})

export function is3DSketchBuildingFloor(node: ChildNodeContainer | undefined, snapshot: ElementSnapshot) {
  if (!node) return false
  if (node.element.properties?.category !== "floor") return false

  const parentPath = ElementKeyPath.of(node.path).parent()?.value
  if (!parentPath) return false

  const parentNode = snapshot.getNodeOrThrow(parentPath)

  // Check if the parent element is a 3d-sketch element
  if (is3dSketchElement(parentNode.element)) {
    return true
  }

  return false
}

export const is3DSketchBuildingFloorSelectedSignal = computed<boolean>(() => {
  const snapshot = elementState.currentSnapshot.value

  //Iterate the selection to check if an element in the selection is a 3d sketch floor
  for (const selectedNode of selectedNodesSignal.value) {
    if (is3DSketchBuildingFloor(selectedNode, snapshot)) return true
  }

  return false
})
