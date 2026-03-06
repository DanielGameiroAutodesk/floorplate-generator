import type { CustomSelectionPath } from "src/core/selection/selectionTypes"
import { parseCustomSelectionPath } from "src/core/selection/selectionTypes"
import { toolAPI } from "src/core/toolsState"
import { createEditTerrainPadsToolConfig } from "src/integrations/terrainPadsExperimental/components/EditTerrainPads"

export function editCustomEntity(selectionPath: CustomSelectionPath) {
  const { integration, id } = parseCustomSelectionPath(selectionPath)

  if (integration === "terrain_pads") {
    toolAPI.setTool(createEditTerrainPadsToolConfig(id))
  } else {
    return
  }
}
