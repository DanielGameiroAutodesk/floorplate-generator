import type { GrossFloorAreaPolygon } from "@spacemakerai/element-types"
import type { GFAUnit } from "src/lib/element/types"
import { getPolygonWithHolesFromSpace, getUnitLookup } from "src/integrations/building-systems-basic-building/lib/utils"
import type { Building3d, EmptyBuilding3d } from "./3dSketchBuildingTypes"

function extractGfaUnitsFromBasicBuilding(building: EmptyBuilding3d) {
  const gfaUnits: Array<GFAUnit & { floorIndex: number }> = []
  for (let i = 0; i < building?.floors3d?.length; i++) {
    const floor = building.floors3d?.[i]
    for (const polygonWithHoles of floor.floorOutline) {
      const coordinates: [number, number][][] = polygonWithHoles
      gfaUnits.push({
        areaType: undefined,
        functionId: undefined,
        areas: [{ coordinates, elevation: floor.elevation }],
        floorIndex: i,
      })
    }
  }
  return gfaUnits
}

export function extractGfaUnitsFrom3dSketchFloorPlans(building: Building3d) {
  if (!("units" in building)) return extractGfaUnitsFromBasicBuilding(building)

  const gfaUnits: Array<GFAUnit & { floorIndex: number }> = []
  const unitLookup = getUnitLookup(building.units)

  for (let i = 0; i < building.floors3d.length; i++) {
    const floor = building.floors3d[i]
    if (floor !== undefined) {
      for (const space of Object.values(floor.spaces)) {
        const unit = unitLookup(floor.id, space.id)
        const polyWithHolesXY = getPolygonWithHolesFromSpace(space, floor.graph)

        const coordinates: [number, number][][] = [
          polyWithHolesXY.polygon.map(({ x, y }) => [x, y]),
          ...polyWithHolesXY.holes.map((hole) => hole.map(({ x, y }): [number, number] => [x, y])),
        ]

        gfaUnits.push({
          areaType: unit?.program as GrossFloorAreaPolygon["areaType"],
          functionId: unit?.functionId,
          areas: [{ coordinates, elevation: floor.elevation }],
          floorIndex: i,
        })
      }
    }
  }
  return gfaUnits
}
