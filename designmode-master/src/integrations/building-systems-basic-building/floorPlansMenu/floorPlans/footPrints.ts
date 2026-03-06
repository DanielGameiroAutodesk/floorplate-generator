import type { BasicPlusBuilding } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanSketcher"
import { getFloorFootPrintsInBuilding } from "src/integrations/building-systems-basic-building/lib/utils"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"

export type FootPrint = PolygonWithHolesXY[]

export type FloorFootPrintByBuildingMap = Record<string, FootPrint[]>
export function getFloorFootPrintsByBuildings(buildings: BasicPlusBuilding[]): FloorFootPrintByBuildingMap {
  const floorFootPrintByBuildingMap: FloorFootPrintByBuildingMap = {}
  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i]
    floorFootPrintByBuildingMap[building.id] = getFloorFootPrintsInBuilding(building)
  }
  return floorFootPrintByBuildingMap
}
