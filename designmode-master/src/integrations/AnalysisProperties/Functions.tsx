import { FunctionDropdown } from "./FunctionDropdown"
import { showLineBuildingMenu } from "src/integrations/building-systems-line-buildings/LineBuildingMenu"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { isSingle3dSketchBuildingSelectedSignal } from "src/integrations/3dsketch/3dsketch-selection-state"
import { selectedNodesSignal } from "src/core/selection/selectionState"

export const Functions = () => {
  const anyBasicBuildings = selectedNodesSignal.value.some((node) => BasicBuildingAPI.isBasicBuilding(node.element))
  const isSingle3dSketchBuildingSelected = isSingle3dSketchBuildingSelectedSignal.value
  if (showLineBuildingMenu(selectedNodesSignal.value) || anyBasicBuildings) {
    return null
  }
  return (
    <>
      {isSingle3dSketchBuildingSelected && (
        <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }} />
      )}
      <FunctionDropdown />
    </>
  )
}
