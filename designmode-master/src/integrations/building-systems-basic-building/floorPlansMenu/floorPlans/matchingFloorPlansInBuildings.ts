import type { BasicPlusBuilding } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanSketcher"
import { doFloorPlansInBuildingMatch } from "./matchingFloors"
import type { FloorFootPrintByBuildingMap, FootPrint } from "./footPrints"
import type { Space, Unit } from "src/integrations/building-systems-basic-building/lib/types"
import { getPolygonWithHolesFromSpace, getUnitLookup } from "src/integrations/building-systems-basic-building/lib/utils"
import type { Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type { ParkingParams } from "src/integrations/building-systems-common/lib-generators/parkingGenerator/parking"
import type { PolygonXY } from "src/lib/geometry/polygonXY"

// SpaceUnit is a merger of Space and Unit
export type SpaceUnit = {
  id: string
  polygon: PolygonXY
  holes: PolygonXY[]
  program: string | undefined
  properties: { functionId?: string }
  generator?: {
    generatorId: "parking"
    params: ParkingParams
  }
}

export type SpaceUnits = SpaceUnit[]

export type FloorTemplate = { spaceUnits: SpaceUnits; footPrint: FootPrint; empty: boolean }
export type FloorPlansByBuilding = FloorTemplate[][]

function isFloorPlanEmpty(spaceUnits: SpaceUnits, footPrint: FootPrint) {
  if (spaceUnits.length !== footPrint.length) return false
  for (const spaceUnit of spaceUnits) {
    if (spaceUnit.program !== undefined && spaceUnit.program !== "undefined") return false
    if (spaceUnit.properties.functionId !== undefined) return false
  }
  return true
}

export function spaceToSpaceUnit(space: Space, unit: Unit | undefined, graph: Graph): SpaceUnit {
  const program = unit?.program || "undefined"
  const properties = { functionId: unit?.functionId }
  return { id: space.id, ...getPolygonWithHolesFromSpace(space, graph), program: program, properties }
}

export function getFloorPlansForSelectedFloorsInBuilding(
  building: BasicPlusBuilding,
  floorFootPrintByBuildingMap: FloorFootPrintByBuildingMap,
): FloorTemplate[] {
  const floorTemplates: FloorTemplate[] = []
  const unitLookup = getUnitLookup(building.units)
  for (let i = 0; i < building.floors.length; i++) {
    if (building.selectedFloors && !building.selectedFloors[i]) continue
    const floor = building.floors[i]
    const spaceUnits: SpaceUnits = Object.values(floor.spaces).map((space) =>
      spaceToSpaceUnit(space, unitLookup(floor.id, space.id), floor.graph),
    )
    const alreadyAdded = floorTemplates.some((addedFloorPlan) => {
      return doFloorPlansInBuildingMatch(addedFloorPlan.spaceUnits, spaceUnits)
    })
    if (alreadyAdded) continue
    const footPrint = floorFootPrintByBuildingMap[building.id][i]
    const empty = isFloorPlanEmpty(spaceUnits, footPrint)
    floorTemplates.push({ spaceUnits, empty, footPrint })
  }
  return floorTemplates
}
export function getUniqueFloorPlansForSelectedFloorsInBuildings(
  buildings: BasicPlusBuilding[],
  maxNumberOfStacks: number,
  seeAllFloors: boolean,
  floorFootPrintByBuildingMap: FloorFootPrintByBuildingMap,
): FloorPlansByBuilding {
  const floorPlansByBuilding: FloorPlansByBuilding = []
  const n = seeAllFloors ? buildings.length : Math.min(buildings.length, maxNumberOfStacks)
  for (let i = 0; i < n; i++) {
    const building = buildings[i]
    floorPlansByBuilding.push(getFloorPlansForSelectedFloorsInBuilding(building, floorFootPrintByBuildingMap))
  }
  return floorPlansByBuilding
}

export function getInitialFloorSelectionOfBuilding(building: BasicPlusBuilding, editSpaceUnits: SpaceUnits): number[] {
  const selectedFloors: number[] = []
  const unitLookup = getUnitLookup(building.units)
  for (let i = 0; i < building.floors.length; i++) {
    if (building.selectedFloors && !building.selectedFloors[i]) continue
    const floor = building.floors[i]
    const spaceUnits: SpaceUnits = Object.values(floor.spaces).map((space) =>
      spaceToSpaceUnit(space, unitLookup(floor.id, space.id), floor.graph),
    )
    const inSelection = doFloorPlansInBuildingMatch(editSpaceUnits, spaceUnits)
    if (inSelection) selectedFloors.push(i)
  }
  if (selectedFloors.length === 0) return [building.floors.length - 1]
  return selectedFloors
}
