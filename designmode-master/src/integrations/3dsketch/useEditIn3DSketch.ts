import { useCallback, useMemo } from "preact/hooks"
import {
  is3dSketchElement,
  isElementEditableIn3DSketchWithCheckSignal,
  isImportElement,
} from "./3dsketch-selection-state"
import { AnalyticsKey, Analytics, type Method } from "src/core/analytics"

import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { useIntegrated3DSketchAPI } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import type { InternalPath } from "src/lib/element/path"
import { isBasicElementUrn } from "src/lib/element/urn"
import {
  useCanConvertTo3dSketch,
  useCanEditIn3dSketch,
  useShouldEditInIntegrated3dSketch,
} from "./useShouldBeEditedIn3DSketch"
import { elementState } from "src/core/elements/ElementState"
import { selectedNodesSignal, selectedPathsInCurrentProposalAsArraySignal } from "src/core/selection/selectionState"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { conceptualElementsApi } from "src/integrations/conceptual-squad/conceptualElementsApi"
import { contextualDataApi } from "src/integrations/contextual-data/api"

export function useIsJustBuildingsSelected() {
  const selectedElements = selectedNodesSignal.value
  return useMemo(
    () =>
      selectedElements.length > 0 && selectedElements.every((node) => BasicBuildingAPI.isBasicBuildingUrn(node.urn)),
    [selectedElements],
  )
}

// get mesh triangle count from an element and all of its children
function getTriangleCountFromAllElementMeshes(path: InternalPath): number | null {
  const elementSnapshot = elementState.currentSnapshot.peek()
  const elementNode = elementSnapshot.getNode(path)
  if (!elementNode) return null

  // returns array of nodes in element
  const childNodeContainers = elementSnapshot.traverseNodes(elementNode, () => true)

  let totalMeshTriangles = 0

  // get triangle count all nodes in an element
  childNodeContainers.forEach((childNodeContainer) => {
    const thisCount = getTriangleCountFromElementContainer(childNodeContainer.elementContainer)
    if (thisCount) {
      totalMeshTriangles += thisCount
    }
  })

  return totalMeshTriangles
}

// get mesh triangle count from an element's container
function getTriangleCountFromElementContainer(elementContainer: ElementContainer): number | null {
  const volumeMesh = elementContainer.representations.volumeMesh
  if (!volumeMesh) return null

  // positions returns vertices, so
  // divide number of vertices by 3 to get triangles
  if (!volumeMesh.index) {
    return volumeMesh.attributes.position.array.length / 3
  }
  return volumeMesh.index.count / 3
}

function useEditIn3DSketch(method: Method) {
  const isBasicBuildingSelected = useIsJustBuildingsSelected()
  const selection = selectedPathsInCurrentProposalAsArraySignal.value
  const snapshot = elementState.currentSnapshot.value
  const i3dsAPI = useIntegrated3DSketchAPI()
  const canConvertTo3ds = useCanConvertTo3dSketch()
  const isElementEditableIn3DSketch = isElementEditableIn3DSketchWithCheckSignal.value
  const shouldEditInIntegrated3dSketch = useShouldEditInIntegrated3dSketch()
  const canEditIn3dSketch = useCanEditIn3dSketch()

  return useCallback(
    (usePath?: InternalPath) => {
      let is3dSketchElementSelected
      let isElementSelectedEditableIn3DSketch
      let isEditableInIntegrated3dSketch

      const useNode = usePath ? snapshot.getNode(usePath) : undefined

      if (usePath && useNode) {
        isElementSelectedEditableIn3DSketch = canEditIn3dSketch(useNode)
        isEditableInIntegrated3dSketch = shouldEditInIntegrated3dSketch(useNode)
      } else {
        isElementSelectedEditableIn3DSketch = isElementEditableIn3DSketch || canConvertTo3ds()
        isEditableInIntegrated3dSketch = shouldEditInIntegrated3dSketch()
      }

      if (!isElementSelectedEditableIn3DSketch && !isEditableInIntegrated3dSketch) return

      // Integrated 3d sketch
      const editingPath = usePath ?? selection[0]
      const element = snapshot.getNode(editingPath)?.element

      if (editingPath && element) {
        i3dsAPI.edit3dMeshByPath(editingPath, false)
        // record triangle count in analytics
        Analytics.track(
          EventName.Use,
          {
            feature_category: FeatureCategory.DesignTool,
            feature: "3dSketch",
            sub_feature: "Triangle count (GLB)",
          },
          {
            num_triangles: getTriangleCountFromAllElementMeshes(editingPath)!,
          },
        )
        is3dSketchElementSelected = is3dSketchElement(element)

        //
        // track the different element types being edited
        //
        let elementType = AnalyticsKey.ElementType_Unknown
        switch (true) {
          // 3D Sketch
          case is3dSketchElementSelected:
            if (conceptualElementsApi.is3DSketchBuildingElement(element)) {
              // 3D Sketch Building
              elementType = AnalyticsKey.ElementType_3DSBuilding
            } else {
              // 3D Sketch Generic
              elementType = AnalyticsKey.ElementType_3DSGeneric
            }
            break
          // Basic Building
          case isBasicBuildingSelected:
            elementType = AnalyticsKey.ElementType_BasicBuilding
            break
          // Constraint
          case element?.properties?.category === "constraints" || element?.properties?.name === "Constraint":
            elementType = AnalyticsKey.ElementType_Constraint
            break
          // Generic volume
          case element?.properties?.category === "volume" || element?.properties?.name === "Volume":
            elementType = AnalyticsKey.ElementType_Volume
            break
          // Generic import
          case isImportElement(element):
            elementType = AnalyticsKey.ElementType_Import
            break
          // Rhino
          case element?.properties?.elementProvider === "Rhino":
            elementType = AnalyticsKey.ElementType_Rhino
            break
          // Dynamo
          case element?.properties?.elementProvider === "dynamo-player":
            elementType = AnalyticsKey.ElementType_Dynamo
            break
          // LOD100 contextual building
          case isBasicElementUrn(element.urn) && element?.properties?.category === "building":
            elementType = AnalyticsKey.ElementType_ContextualLOD100
            break
          // LOD200 contextual building
          case contextualDataApi.isLoD2Building(element):
            elementType = AnalyticsKey.ElementType_ContextualLOD200
            break
        }

        Analytics.trackSelectTool("3dSketch", `Edit ${elementType} element in 3D Sketch`, method, "design-tool")
      }
    },
    [
      snapshot,
      canEditIn3dSketch,
      canConvertTo3ds,
      shouldEditInIntegrated3dSketch,
      isElementEditableIn3DSketch,
      selection,
      i3dsAPI,
      method,
      isBasicBuildingSelected,
    ],
  )
}

export default useEditIn3DSketch
