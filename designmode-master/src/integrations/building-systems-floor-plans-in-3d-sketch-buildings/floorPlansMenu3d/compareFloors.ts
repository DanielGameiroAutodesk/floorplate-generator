import { doFloorPlansInBuildingMatch } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloors"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"

export function compareFloorOutlines(outlineOne: PolygonWithHolesXY[], outlineTwo: PolygonWithHolesXY[]) {
  return doFloorPlansInBuildingMatch(
    outlineOne.map((polygonWithHoles) => ({ ...polygonWithHoles, id: "", program: undefined, properties: {} })),
    outlineTwo.map((polygonWithHoles) => ({ ...polygonWithHoles, id: "", program: undefined, properties: {} })),
  )
}
