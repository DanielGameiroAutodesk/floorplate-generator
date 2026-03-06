import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRecoilCallback } from "recoil"
import type { FormaElement, Transform } from "@spacemakerai/element-types"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { createBasicBuildingFromSimpleBuilding } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/createBasicBuildingFromSimpleBuilding"
import type { BasicBuilding } from "src/integrations/building-systems-basic-building/lib/types"
import { elementState } from "src/core/elements/ElementState"
import { contextRootSignal } from "src/core/selection/selectionState"
import { onlyKeepEditProperties } from "./properties"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"

export function useReleaseLineBuildingToBasicBuilding() {
  const actionApi = useActionAPI()

  return useRecoilCallback(
    () => (element: FormaElement, path: string) => {
      const snapshot = elementState.currentSnapshot.peek()
      const parameters = element?.properties?.generator?.parameters
      const propertiesToKeep = onlyKeepEditProperties(element?.properties)
      const worldMatrix = snapshot.getNodeOrThrow(path).globalMatrix

      const customLayouts = parameters.customLayouts || []
      const simpleBuildings = lineBuildingApi.getBakeToSimpleBuildings(parameters, customLayouts)

      const addActions: any[] = []
      const newPaths: string[] = []

      for (let i = 0; i < simpleBuildings.length; i++) {
        const simpleBuilding = simpleBuildings[i]
        const basicBuilding: BasicBuilding = createBasicBuildingFromSimpleBuilding(simpleBuilding)
        basicBuilding.customProperties = { ...propertiesToKeep }
        const transform: Transform = worldMatrix.toArray()
        const { key, actions } = BasicBuildingAPI.actions.createAddActions(basicBuilding, transform, actionApi)
        addActions.push(...actions)
        const path = contextRootSignal.peek() + "/" + key
        newPaths.push(path)
      }

      actionApi.apply(
        "Bake line building to new BasicBuildings",
        [...addActions, { type: "delete", path }],
        undefined,
        (current) => {
          const newSelection = new Set(current)
          newSelection.delete(path)
          for (const path of newPaths) {
            newSelection.add(path)
          }
          return newSelection
        },
      )

      // Track building creation from line building conversion
      for (let i = 0; i < simpleBuildings.length; i++) {
        dispatchBuildingEvent("basic_building", EventName.Add, "building_conversion")
      }
    },
    [actionApi],
  )
}
