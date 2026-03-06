import type { Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type { BuildingGrid, Spaces, Unit } from "src/integrations/building-systems-basic-building/lib/types"
import type { Child, Representation, Urn } from "@spacemakerai/element-types"

declare module "forma-elements" {
  interface Representations {
    buildingFloors3DSketch_UNSTABLE?: Representation<Building3d>
  }
}

type Point2d = [number, number]
export type MultiPolygon = Point2d[][][]

//Discussions on properties below here https://spacemakercore.slack.com/archives/C040M2UN41Z/p1711138835313959
//Not yet clear why we need id, evelvation, and height.
export type EmptyFloor3d = {
  id: string
  elevation: number
  height?: number
  floorOutline: MultiPolygon
}

export type FilledFloor3d = EmptyFloor3d & { graph: Graph; spaces: Spaces }

export function isFilledFloor3d(floor: EmptyFloor3d | FilledFloor3d): floor is FilledFloor3d {
  return "graph" in floor && "spaces" in floor
}

export type EmptyBuilding3d = {
  floors3d: EmptyFloor3d[]
  grid?: BuildingGrid
}

export type FilledBuilding3d = {
  floors3d: FilledFloor3d[]
  units: Unit[]
  grid?: BuildingGrid
}

export type Building3d = EmptyBuilding3d | FilledBuilding3d

export type Sketch3dBuilding = {
  urn: Urn
  children: Child[]
  representations: {
    building3d: Building3d
  }
}
