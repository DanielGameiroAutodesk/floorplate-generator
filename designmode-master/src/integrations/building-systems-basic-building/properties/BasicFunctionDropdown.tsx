import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback, useMemo } from "preact/hooks"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import type { BasicSelection } from "./BasicBuildingProperties"
import type { UnitFunction } from "src/lib/components/FormaFunctionDropdown"
import { FormaFunctionDropdown } from "src/lib/components/FormaFunctionDropdown"
import { PROJECT_ID } from "src/core/project/project"
import { canEditProposalSignal } from "src/core/edit-access-state"

export default function BasicFunctionDropdown({ selections }: { selections: BasicSelection[] }) {
  const actionAPI = useActionAPI()

  const selectedBuildingFunctions = useMemo(() => {
    const functionNames = new Set<string>()
    const functionIds = new Set<string>()
    for (const result of selections) {
      for (const index of result.floorIndices) {
        const floor = result.building.floors[index]
        result.building.units.forEach((unit) => {
          const unitFloorId = unit.spaces[0].floorId
          if (unitFloorId === floor.id) {
            if (unit.function) functionNames.add(unit.function)
            else functionIds.add(unit.functionId ? unit.functionId : "unspecified")
          }
        })
      }
    }
    const functions: UnitFunction[] = []
    for (const functionId of functionIds) {
      functions.push({ functionId })
    }
    for (const functionName of functionNames) {
      functions.push({ functionName })
    }
    return functions
  }, [selections])

  const setBuildingFunction = useCallback(
    (f: UnitFunction) => {
      const actions: Action[] = []
      for (const result of selections) {
        const updatedBuilding = {
          ...result.building,
          units: result.building.units.map((unit) => {
            // if at least one space in the unit is on the selected floor, update the unit with the functionId
            if (
              unit.spaces.some((space) =>
                result.floorIndices.includes(result.building.floors.findIndex((floor) => floor.id === space.floorId)),
              )
            ) {
              return { ...unit, functionId: f.functionId }
            }
            return unit
          }),
        }
        actions.push(
          ...BasicBuildingAPI.actions.createUpdateActions(
            result.buildingPath,
            result.buildingElement,
            updatedBuilding,
            actionAPI,
          ),
        )
      }
      actionAPI.apply("Set function", actions)
    },
    [actionAPI, selections],
  )

  return (
    <FormaFunctionDropdown
      projectId={PROJECT_ID}
      canEdit={canEditProposalSignal.value}
      setBuildingFunction={setBuildingFunction}
      selectedBuildingFunctions={selectedBuildingFunctions}
    />
  )
}
