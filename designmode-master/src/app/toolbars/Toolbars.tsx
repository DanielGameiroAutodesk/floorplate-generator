import CoreToolbar from "./CoreToolbar/CoreToolbar"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { isInScenarioSignal } from "src/integrations/Scenarios/scenarioSelectors"

export const Toolbars = () => {
  const isEditingBase = scenarioModeSignal.value
  const isInScenario = isInScenarioSignal.value
  const pushToolbarDownward = isEditingBase || isInScenario

  return (
    <div
      style={pushToolbarDownward ? { marginTop: "35px" } : {}}
      className="ToolbarContainerTopCenter"
      data-intercom-target="toolbar"
    >
      <CoreToolbar />
    </div>
  )
}
