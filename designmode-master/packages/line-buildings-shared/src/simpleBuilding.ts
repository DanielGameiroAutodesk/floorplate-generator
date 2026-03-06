import type { PolygonWithHoles } from "./lineBuildingGenerator/lib/lineBuilding9000/BuildingTypes.js"

type Transform = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

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
