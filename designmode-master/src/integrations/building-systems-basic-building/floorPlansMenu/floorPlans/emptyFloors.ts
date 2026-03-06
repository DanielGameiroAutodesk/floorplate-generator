import type { SpaceUnits } from "./matchingFloorPlansInBuildings"
import { spaceToSpaceUnit } from "./matchingFloorPlansInBuildings"
import { doFloorPlansInBuildingMatch } from "./matchingFloors"
import type { BasicPlusBuilding } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanSketcher"
import type { FootPrint } from "./footPrints"
import type { VertexPolygon } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/graph/graph"
import { removeLastPointInPolygonIfEqualsFirst } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  cleanupDeadUnitRefs,
  getUnitLookup,
  randomId,
} from "src/integrations/building-systems-basic-building/lib/utils"
import type {
  BasicBuilding,
  Floor,
  Space,
  Spaces,
  Unit,
} from "src/integrations/building-systems-basic-building/lib/types"
import type { Edge, Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"

function makeFloorFromFootPrint(footPrint: FootPrint): { spaces: Spaces; graph: Graph } {
  const graph: Graph = { vertices: {}, edges: {} }
  const spaces: Spaces = {}
  for (const polygonWithHoles of footPrint) {
    const polygon: VertexPolygon = removeLastPointInPolygonIfEqualsFirst(polygonWithHoles.polygon).map((point) => ({
      ...point,
      id: randomId(),
    }))
    const holes: VertexPolygon[] = polygonWithHoles.holes.map((hole) =>
      removeLastPointInPolygonIfEqualsFirst(hole).map((point) => ({ ...point, id: randomId() })),
    )

    const n = polygon.length
    for (let i = 0; i < n; i++) {
      const v0 = polygon[i]
      const v1 = polygon[(i + 1) % n]
      graph.vertices[v0.id] = v0
      const edge: Edge = { id: randomId(), start: v0.id, end: v1.id }
      graph.edges[edge.id] = edge
    }
    for (const hole of holes) {
      const n = hole.length
      for (let i = 0; i < n; i++) {
        const v0 = hole[i]
        const v1 = hole[(i + 1) % n]
        graph.vertices[v0.id] = v0
        const edge: Edge = { id: randomId(), start: v0.id, end: v1.id }
        graph.edges[edge.id] = edge
      }
    }

    const space: Space = {
      polygon: polygon.map((v) => v.id),
      holes: holes.map((hole) => hole.map((v) => v.id)),
      id: randomId(),
      program: undefined,
    }
    spaces[space.id] = space
  }
  return { spaces, graph }
}

export function emptyFloorsInBuilding(building: BasicPlusBuilding, footPrints: FootPrint[]): BasicBuilding {
  const floors: Floor[] = []
  const newUnits: BasicBuilding["units"] = []
  for (let i = 0; i < building.floors.length; i++) {
    const floor = building.floors[i]
    if (building.selectedFloors && !building.selectedFloors[i]) {
      floors.push(floor)
      continue
    }
    const footPrint = footPrints[i]
    const updatedFloor = makeFloorFromFootPrint(footPrint)
    for (const space of Object.values(updatedFloor.spaces)) {
      const unit: Unit = {
        id: randomId(),
        spaces: [{ floorId: floor.id, spaceId: space.id }],
        program: undefined,
        functionId: undefined,
      }
      newUnits.push(unit)
    }
    floors.push({ ...floor, ...updatedFloor })
  }

  const updatedUnits = cleanupDeadUnitRefs(building.units, floors)
  updatedUnits.push(...newUnits)

  return { floors, units: updatedUnits }
}
export function emptyFloorsWithFloorPlanInBuilding(
  building: BasicPlusBuilding,
  deleteFloorPlan: SpaceUnits,
  footPrints: FootPrint[],
): BasicBuilding {
  const floors: Floor[] = []
  const newUnits: BasicBuilding["units"] = []
  const unitLookup = getUnitLookup(building.units)
  for (let i = 0; i < building.floors.length; i++) {
    const floor = building.floors[i]
    if (building.selectedFloors && !building.selectedFloors[i]) {
      floors.push(floor)
      continue
    }
    const floorPlan: SpaceUnits = Object.values(floor.spaces).map((space) =>
      spaceToSpaceUnit(space, unitLookup(floor.id, space.id), floor.graph),
    )
    const inSelection = doFloorPlansInBuildingMatch(deleteFloorPlan, floorPlan)
    if (!inSelection) {
      floors.push(floor)
      continue
    }
    const footPrint = footPrints[i]
    const updatedFloor = makeFloorFromFootPrint(footPrint)
    for (const space of Object.values(updatedFloor.spaces)) {
      const unit: Unit = {
        id: randomId(),
        spaces: [{ floorId: floor.id, spaceId: space.id }],
        program: undefined,
        functionId: undefined,
      }
      newUnits.push(unit)
    }
    floors.push({ ...floor, ...updatedFloor })
  }

  const updatedUnits = cleanupDeadUnitRefs(building.units, floors)
  updatedUnits.push(...newUnits)
  return { floors, units: updatedUnits }
}
