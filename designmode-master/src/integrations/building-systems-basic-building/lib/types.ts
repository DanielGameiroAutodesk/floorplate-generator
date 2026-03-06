import type { Polygon, PolygonWithHoles } from "./geometry/geometry"
import type { Graph } from "./graph/graph"
import type { ParkingParams } from "src/integrations/building-systems-common/lib-generators/parkingGenerator/parking"
import type { FormaElement } from "@spacemakerai/element-types"

export type BasicBuildingElement = FormaElement & {
  properties: {
    category: "building"
  }
  representations: {
    __INTERNAL__: {
      type: "embedded-json"
      data: BasicBuilding
    }
  }
}

export type ParkingRepresentation = {
  parkingAreas: PolygonWithHoles[]
  parkingSpots: Polygon[]
}

export type Space = {
  id: string
  program?: string
  polygon: string[]
  holes: string[][]
}

export type Unit = {
  id: string
  program?: "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING"
  spaces: { floorId: string; spaceId: string }[]
  function?: string
  functionId?: string
  generator?: {
    generatorId: "parking"
    params: ParkingParams
  }
}
export type Floor = {
  id: string
  graph: Graph
  spaces: Record<string, Space>
  height: number
}

export type CustomProperties = Record<string, Record<string, any>>

type PointXY = { x: number; y: number }
export type BuildingGrid = { gridResolution: PointXY; origin: PointXY; direction: PointXY; cameraDirection: PointXY }
export type BasicBuilding = {
  floors: Floor[]
  units: Unit[]
  grid?: BuildingGrid
  customProperties?: CustomProperties
}

export type Spaces = Record<string, Space>
