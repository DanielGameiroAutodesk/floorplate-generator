import type { GFAUnit } from "src/lib/element/types"
import type { SimpleBuilding, SimpleFloor } from "./simpleBuilding"

type MultiRingPolygon = [number, number][][]
type GrossFloorAreaType = "CORE" | "CORRIDOR" | "LIVING_UNIT" | "UNASSIGNED"
type GrossFloorAreaPolygon = {
  grossFloorPolygon: MultiRingPolygon
  elevation: number
  areaType: GrossFloorAreaType
}

export function simpleBuildingToGrossFloorPolygons(simpleBuilding: SimpleBuilding): GrossFloorAreaPolygon[] {
  const grossFloorAreaPolygons: GrossFloorAreaPolygon[] = []
  let elevation = 0
  simpleBuilding.floors.forEach((floor) => {
    grossFloorAreaPolygons.push(...simpleFloorToGrossFloorPolygons(floor, elevation))
    elevation += floor.height
  })
  return grossFloorAreaPolygons
}
export function simpleFloorToGrossFloorPolygons(simpleFloor: SimpleFloor, elevation: number): GrossFloorAreaPolygon[] {
  return simpleFloor.content?.type === "floorPlan"
    ? simpleFloor.content.units.map((unit) => {
        const grossFloorPolygon = [unit.polygon, ...unit.holes] as MultiRingPolygon
        const areaType = unit.type || "UNASSIGNED"
        return { grossFloorPolygon, elevation, areaType }
      })
    : simpleFloor.outerShapes.map((outerShape) => {
        const grossFloorPolygon = [outerShape.polygon, ...outerShape.holes] as MultiRingPolygon
        const areaType = "UNASSIGNED"
        return { grossFloorPolygon, elevation, areaType }
      })
}

export function simpleBuildingToUnitFloorPolygons(simpleBuilding: SimpleBuilding, functionId: string): GFAUnit[] {
  const unitFloorPolygons: GFAUnit[] = []

  let elevation = 0
  simpleBuilding.floors.forEach((floor) => {
    unitFloorPolygons.push(...simpleFloorToUnitFloorPolygons(floor, elevation, functionId))
    elevation += floor.height
  })
  return unitFloorPolygons
}

export function simpleFloorToUnitFloorPolygons(
  simpleFloor: SimpleFloor,
  elevation: number,
  functionId: string,
): GFAUnit[] {
  return simpleFloor.content?.type === "floorPlan"
    ? simpleFloor.content.units.map((unit) => {
        const unitsFloorPolygon = [unit.polygon, ...unit.holes] as MultiRingPolygon
        return { areaType: unit.type, areas: [{ elevation, coordinates: unitsFloorPolygon }], functionId }
      })
    : simpleFloor.outerShapes.map((outerShape) => {
        const unitsFloorPolygon = [outerShape.polygon, ...outerShape.holes] as MultiRingPolygon
        return { functionId, areas: [{ elevation, coordinates: unitsFloorPolygon }] }
      })
}

export function getGrossFloorUnitsRepr(simpleBuildings: SimpleBuilding[], functionId: string): GFAUnit[] {
  return simpleBuildings.flatMap((building) => simpleBuildingToUnitFloorPolygons(building, functionId))
}
