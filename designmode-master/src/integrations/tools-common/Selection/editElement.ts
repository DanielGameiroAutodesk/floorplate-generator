import type { FormaElement } from "@spacemakerai/element-types"
import { getEditToolConfig } from "src/integrations/tools-common/ToolWrapper"
import { isBasicElementUrn, parseUrn } from "src/lib/element/urn"
import useShouldBeEditedIn3DSketch from "src/integrations/3dsketch/useShouldBeEditedIn3DSketch"
import useEditIn3DSketch from "src/integrations/3dsketch/useEditIn3DSketch"
import {
  isReferenceImage,
  makeEditReferenceImageToolCfg,
} from "src/integrations/tools-common/Transform2D/EditReferenceImage"
import { isGeneratedElement } from "src/integrations/extensions-generators/elements"
import { makeEditBasicElementToolCfg } from "src/integrations/basic-elements/tooling/EditBasicElement"
import { editComposedElement } from "src/integrations/composition-site-graph/graph-element/EditCompositionGraph"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { EditLabelToolCfg } from "src/integrations/labels/LabelTool/EditLabel"
import isLabelElement from "src/integrations/labels/isLabel"
import { useCallback } from "preact/hooks"
import { rasterAPI } from "src/integrations/raster-element-system/api"
import { toolAPI } from "src/core/toolsState"
import transportationApi from "src/integrations/transportation/lib/transportationApi"
import { makeEditTransportCurveToolConfig } from "src/integrations/transportation/tools/EditTransportCurve"
import {
  initIterativeExploreEditToolCfg,
  isSiteExploreAreaElement,
} from "src/integrations/building-systems-site-study/iterative"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { migrateRoadOrRail } from "src/integrations/transportation/migration"
import { setSelectionSetSignalValue } from "src/core/selection/selectionState"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "src/integrations/building-systems-site-study/iterative/constants"

export type EditedElementEvent = CustomEvent<{ path: string }>

export const isConstraintElement = (element?: FormaElement) => {
  return (
    element?.properties?.category === "constraints" ||
    // Added for data regression caused by https://github.com/spacemakerai/designmode/pull/2301
    element?.properties?.name === "Constraint"
  )
}

export const isIntegrateElement = (element?: FormaElement) => {
  if (!element) return false
  return parseUrn(element.urn).system === "integrate"
}

export const isElementProviderNot3dsEditable = (element?: FormaElement) => {
  return ["Revit", "Rhino"].includes(element?.properties?.elementProvider)
}

/**
 * Used to determine if you can edit an element, and thereby activating double-click / edit in context menu / enter key
 * when selecting it
 * @param element
 */
export const isEditable = (element: FormaElement) => {
  return (
    isLabelElement(element) ||
    isGeneratedElement(element) ||
    isBasicElementUrn(element.urn) ||
    isCompositionElement(element) ||
    isConstraintElement(element) ||
    lineBuildingApi.isLineBuildingFormaElement(element) ||
    BasicBuildingAPI.isBasicBuilding(element) ||
    BasicBuildingAPI.isBasicFloor(element) ||
    transportationApi.isTransportationElement(element) ||
    isSiteExploreAreaElement(element)
  )
}

export function useEditNode(method?: "hotkey" | "double-click" | "context-menu") {
  const shouldEditIn3dSketch = useShouldBeEditedIn3DSketch()
  const editIn3DSketch = useEditIn3DSketch("double_click")

  return useCallback(
    (node: ChildNodeContainer) => {
      const element = node.element
      const path = node.path

      if (isLabelElement(element)) {
        toolAPI.setTool(EditLabelToolCfg)
      }

      if (isGeneratedElement(element)) {
        sendEditedElementMessage(path)
        return
      }

      if (isCompositionElement(element)) {
        toolAPI.setTool(editComposedElement(path))
        return
      }

      if (isSiteExploreAreaElement(element)) {
        Analytics.track(
          EventName.Select,
          {
            feature_category: FeatureCategory.DesignTool,
            feature: ITERATIVE_EXPLORE_FEATURE_NAME,
            sub_feature: "edit_tool",
          },
          { method },
        )
        toolAPI.setTool(initIterativeExploreEditToolCfg(path))
        return
      }

      if (shouldEditIn3dSketch(path)) {
        // Special handling for 3d sketch
        console.log("Editing 3d sketch element")
        editIn3DSketch(path)
        return
      }

      if (rasterAPI.isRasterElement(element)) {
        toolAPI.setTool(makeEditReferenceImageToolCfg(path))
      } else if (isBasicElementUrn(element.urn) && isReferenceImage(element)) {
        toolAPI.setTool(makeEditReferenceImageToolCfg(path))
      } else if (isBasicElementUrn(element.urn)) {
        toolAPI.setTool(makeEditBasicElementToolCfg(path))
      } else if (transportationApi.isTransportationElement(element)) {
        toolAPI.setTool(makeEditTransportCurveToolConfig(path))
      }

      if (isLegacyTransportationElement(element)) {
        const newNodePath = migrateRoadOrRail(element, node)
        if (newNodePath) {
          setSelectionSetSignalValue(new Set([newNodePath]))
          toolAPI.setTool(makeEditTransportCurveToolConfig(newNodePath))
          return
        }
      }

      const editToolConfig = getEditToolConfig(element, path)
      if (editToolConfig) {
        toolAPI.setTool(editToolConfig)
        return
      }
    },
    [shouldEditIn3dSketch, method, editIn3DSketch],
  )
}

function isLegacyTransportationElement(element: FormaElement) {
  return (
    isBasicElementUrn(element.urn) &&
    (element.properties?.category === "road" || element.properties?.category === "rails")
  )
}

function sendEditedElementMessage(path: string) {
  const event: EditedElementEvent = new CustomEvent("experimental/editedElement", { detail: { path } })
  window.dispatchEvent(event)
}
