import type { CustomSelectionPath } from "src/core/selection/selectionTypes"
import { parseCustomSelectionPath } from "src/core/selection/selectionTypes"
import { elementState } from "src/core/elements/ElementState"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { selectionPathsSignal, setSelectionPathsSignalValue } from "src/core/selection/selectionState"
import { Set_shallowEquals } from "src/lib/set"

export function deleteCustomEntities(paths: CustomSelectionPath[]) {
  const terrainPadIds: string[] = []

  paths.forEach((path) => {
    const { integration, id } = parseCustomSelectionPath(path)
    if (integration === "terrain_pads") {
      terrainPadIds.push(id)
    }
  })

  if (terrainPadIds.length > 0) {
    const currentTerrain = elementState.currentTerrainSignal.peek()
    if (currentTerrain) {
      terrainApi.deleteTerrainPads(currentTerrain, terrainPadIds)
      const currentSelection = selectionPathsSignal.peek()
      const updatedSelection = new Set([...currentSelection].filter((p) => !paths.includes(p as CustomSelectionPath)))
      setSelectionPathsSignalValue(
        Set_shallowEquals(updatedSelection, currentSelection) ? currentSelection : updatedSelection,
      )
    } else {
      console.warn("Couldn't delete terrain pads: current terrain not available")
    }
  }
}
