import type { ToolCfg } from "src/core/toolsState"
import { toolAPI } from "src/core/toolsState"
import { resetSelectionSetSignal } from "src/core/selection/selectionState"
import { useEffect } from "preact/compat"
import { getLineBuildingEditConfig } from "src/integrations/building-systems-line-buildings/EditLineBuilding"
import type { FormaElement } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { isGeneratedElement } from "src/integrations/extensions-generators/elements"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import {
  EditBasicBuilding,
  EditBasicFloor,
} from "src/integrations/building-systems-basic-building/editBuilding3D/EditBasicBuildingTool"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import {
  formitInitializedSignal,
  useInitializeFormitCoreCallback,
} from "src/integrations/wsm-tools/wsr/api/useInitialize"

export function updateSidebarOnHotkey(prev: { left: boolean; right: boolean }) {
  return prev && prev.left && prev.right ? { left: false, right: false } : { left: true, right: true }
}

export function getEditComponent(
  element: FormaElement,
): (({ path }: { path: InternalPath }) => JSX.Element | null) | undefined {
  if (isGeneratedElement(element)) {
    // The edit component for a generated element is rendered in the right menu.
    return () => null
  }

  return undefined
}

export function getEditToolConfig(element: FormaElement, path: string): ToolCfg | undefined {
  if (BasicBuildingAPI.isBasicBuilding(element))
    return {
      id: "editNewBasicBuilding",
      tool: () => <EditBasicBuilding path={path} />,
      toolbar: () => <ToolbarCloseButton />,
      propertyPanel: "default",
    }
  if (BasicBuildingAPI.isBasicFloor(element)) {
    return {
      id: "editNewBasicBuildingFloor",
      tool: () => <EditBasicFloor path={path} />,
      toolbar: () => <ToolbarCloseButton />,
      propertyPanel: "default",
    }
  }
  if (lineBuildingApi.isLineBuildingFormaElement(element)) return getLineBuildingEditConfig(path)
}

export default function ToolWrapper() {
  const currentTool = toolAPI.currentToolSignal.value

  const isWSMLoaded = formitInitializedSignal.value
  const initializeWSM = useInitializeFormitCoreCallback()

  useEffect(() => {
    if (currentTool.needsWSM && !isWSMLoaded) {
      void initializeWSM()
    }
  }, [initializeWSM, isWSMLoaded, currentTool.needsWSM])

  useEffect(() => {
    if (currentTool.id === "createGeneratorElement") {
      resetSelectionSetSignal()
    }
  }, [currentTool])

  return !currentTool.needsWSM || isWSMLoaded ? <currentTool.tool /> : null
}
