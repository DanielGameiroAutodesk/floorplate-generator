import type { ParkingParams } from "src/integrations/building-systems-common/lib-generators/parkingGenerator/parking"
import type { PolygonWithHoles } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"

export type SimpleBuilding = {
  id?: string
  floors: SimpleFloor[]
}

export type SimpleFloor = {
  id?: string
  outerShapes: PolygonWithHoles[]
  height: number
  content?: SimpleFloorPlan
  functionId?: string
}

export type SimpleFloorPlan = {
  type: "floorPlan"
  units: SimpleUnit[]
}

export type SimpleUnit =
  | ({
      id?: string
      type?: "LIVING_UNIT" | "CORE" | "CORRIDOR" | "UNASSIGNED"
    } & PolygonWithHoles)
  | SimpleParkingUnit

type SimpleParkingUnit = {
  id?: string
  type?: "PARKING"
  params: ParkingParams
} & PolygonWithHoles
