import BasicBuildingAPI from "./BasicBuildingAPI"
import type { BasicBuilding } from "./lib/types"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { BuiltInSurfaceFunctions, type Surface } from "src/integrations/area-stats/surface"

export function generateAreaStatsSurfaces(container: ElementContainer): Surface[] | undefined {
  if (!BasicBuildingAPI.isBasicBuilding(container.element)) return []
  const building: BasicBuilding = container.element.representations.__INTERNAL__.data

  if (building.floors.length < 1) return []
  const groundFloor = building.floors[0]

  const groundFloorPolygon = BasicBuildingAPI.calculateFloorPolygon(groundFloor)
  return groundFloorPolygon.map((p) => ({
    functions: [{ id: BuiltInSurfaceFunctions.Building }],
    polygon: [p.polygon, ...p.holes],
    horizontalProjection: {
      type: "atElevation",
      elevation: 0,
    },
  }))
}
