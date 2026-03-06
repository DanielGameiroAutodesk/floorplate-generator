import {
  hoveredSelectionPathsSignal,
  selectedBasePathsInProposalContextSignal,
  selectionPathsSignal,
  selectPaths,
  useSetHoveredSelectionPaths,
} from "src/core/selection/selectionState"
import { useDoubleClick } from "./useDoubleClick"
import { AffineTool } from "src/integrations/tools-common/AffineTooling/AffineTool"
import PushPull from "src/integrations/tools-common/PushPull/PushPull"
import ContextMenuWrapper from "src/integrations/ContextMenu/ContextMenu"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import useMovableElementsSelected from "src/integrations/Toolbars/CoreToolbar/domain/affine/useMovableElementsSelected"
import type { ToolCfg } from "src/core/toolsState"
import { SelectionHotkeys } from "./SelectionHotkeys"
import { SelectionToolComponent } from "./SelectionToolComponent"
import { BasicBuildingsPushPull } from "src/integrations/building-systems-basic-building/editBuilding3D/pushPull"
import { raycastTargetsSignal } from "src/core/selection/raycast-targets"
import { elementState } from "src/core/elements/ElementState"
import {
  elementSelectionPathToInternalPath,
  isCustomSelectionPath,
  isElementSelectionPath,
  type SelectionPath,
} from "src/core/selection/selectionTypes"
import { PushPullPad } from "src/integrations/terrainPadsExperimental/components/PushPullPad"
import { cameraApi } from "src/integrations/camera/CameraAPI"

const SelectionTool = () => {
  const currentSelectionPaths = selectionPathsSignal.value
  const setCurrentSelectionPaths = useSetHoveredSelectionPaths()
  const hoveredIds = hoveredSelectionPathsSignal.value
  const doubleClickCallback = useDoubleClick()
  const movableElementsSelected = useMovableElementsSelected()
  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value
  const is3Dview = cameraApi.getCameraSettings().type === "perspective"

  const enableTerrainPads = true

  const isVolumeOrConstraintSelected = (currentSelection: Set<SelectionPath>) => {
    const snapshot = elementState.currentSnapshot.peek()

    return Array.from(currentSelection)
      .filter(isElementSelectionPath)
      .map(elementSelectionPathToInternalPath)
      .some((path) => {
        const node = snapshot.getNode(path)
        const category = node?.element.properties?.category
        return category === "constraints" || category === "generic"
      })
  }
  const isCustomSelection = Array.from(currentSelectionPaths).some((x) => isCustomSelectionPath(x))
  return (
    <>
      <SelectionToolComponent
        raycastTargets={raycastTargetsSignal.value}
        currentSelectionPaths={currentSelectionPaths}
        selectPaths={(paths) => {
          // Commented out, as there is a lot of events from this one
          // TrackingV2.track(EventName.Select, {
          //   feature_category: FeatureCategory.SceneTool,
          //   feature: "selection_tool",
          //   object_type: "element",
          // })
          selectPaths(paths)
        }}
        setCurrentHoverPaths={setCurrentSelectionPaths}
        hoveredPaths={hoveredIds}
        doubleClickCallback={doubleClickCallback}
      />
      <IfEditAccess>
        {movableElementsSelected && <AffineTool />}
        {/* Enable PushPull for basic buildings only */}
        {selectedBasePathsInProposalContext.size === 0 &&
          !isVolumeOrConstraintSelected(currentSelectionPaths) &&
          !isCustomSelection && <PushPull />}
        {enableTerrainPads && isCustomSelection && is3Dview && <PushPullPad />}
        <BasicBuildingsPushPull />
        <ContextMenuWrapper />
      </IfEditAccess>
      <SelectionHotkeys />
    </>
  )
}

export const SelectionToolCfg: ToolCfg = {
  id: "select",
  tool: SelectionTool,
  toolbar: "topLevel",
  propertyPanel: "default",
}
