import type { Transform } from "@spacemakerai/element-types"
import type { PolygonWithHoles } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"

export type PlacedSimpleBuilding = SimpleBuilding & {
  transform: Transform
}

export type SimpleBuilding = {
  id?: string
  floors: SimpleFloor[]
}

export type SimpleFloor = {
  id?: string
  outerShapes: PolygonWithHoles[]
  height: number
  content?: SimpleFloorPlan
}

export type SimpleFloorPlan = {
  type: "floorPlan"
  units: SimpleUnit[]
}
export type SimpleUnit = {
  id?: string
  type?: "LIVING_UNIT" | "CORE" | "CORRIDOR" | "UNASSIGNED"
} & PolygonWithHoles
