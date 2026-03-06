import type { FixedFloor } from "./MeshFps"
import type { Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type { Spaces, Unit } from "src/integrations/building-systems-basic-building/lib/types"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"
import type { MeshBuildingFloorPlans } from "./FloorPlansMenu3d"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"

export function isBuildingEmpty(buildingFloorPlans: MeshBuildingFloorPlans | undefined): boolean {
  if (buildingFloorPlans === undefined) return true

  for (const unit of buildingFloorPlans.units) {
    if (unit.program) return false
  }

  for (const floor of buildingFloorPlans.floors) {
    const usedEdge: Record<string, boolean> = {}
    for (const space of Object.values(floor.spaces)) {
      const polygon = space.polygon
      const n = polygon.length
      for (let i = 0; i < n; i++) {
        const vOneId = polygon[i]
        const vTwoId = polygon[(i + 1) % n]
        if (vOneId === vTwoId) continue
        const edgeKeyOne = vOneId + vTwoId
        const edgeKeyTwo = vTwoId + vOneId
        if (usedEdge[edgeKeyOne] || usedEdge[edgeKeyTwo]) return false
        usedEdge[edgeKeyOne] = true
        usedEdge[edgeKeyTwo] = true
      }
      for (const hole of space.holes) {
        const m = hole.length
        for (let i = 0; i < m; i++) {
          const vOneId = hole[i]
          const vTwoId = hole[(i + 1) % m]
          if (vOneId === vTwoId) continue
          const edgeKeyOne = vOneId + vTwoId
          const edgeKeyTwo = vTwoId + vOneId
          if (usedEdge[edgeKeyOne] || usedEdge[edgeKeyTwo]) return false
          usedEdge[edgeKeyOne] = true
          usedEdge[edgeKeyTwo] = true
        }
      }
    }
  }
  return true
}

export function isFloorEmpty(buildingFloorPlans: MeshBuildingFloorPlans | undefined, floorId: string): boolean {
  if (buildingFloorPlans === undefined) return true

  for (const unit of buildingFloorPlans.units) {
    const unitOnFloor = unit.spaces.some((space) => space.floorId === floorId)
    if (!unitOnFloor) continue
    if (unit.program) return false
  }

  for (const floor of buildingFloorPlans.floors) {
    if (floor.id !== floorId) continue
    const usedEdge: Record<string, boolean> = {}
    for (const space of Object.values(floor.spaces)) {
      const polygon = space.polygon
      const n = polygon.length
      for (let i = 0; i < n; i++) {
        const vOneId = polygon[i]
        const vTwoId = polygon[(i + 1) % n]
        if (vOneId === vTwoId) continue
        const edgeKeyOne = vOneId + vTwoId
        const edgeKeyTwo = vTwoId + vOneId
        if (usedEdge[edgeKeyOne] || usedEdge[edgeKeyTwo]) return false
        usedEdge[edgeKeyOne] = true
        usedEdge[edgeKeyTwo] = true
      }
      for (const hole of space.holes) {
        const m = hole.length
        for (let i = 0; i < m; i++) {
          const vOneId = hole[i]
          const vTwoId = hole[(i + 1) % m]
          if (vOneId === vTwoId) continue
          const edgeKeyOne = vOneId + vTwoId
          const edgeKeyTwo = vTwoId + vOneId
          if (usedEdge[edgeKeyOne] || usedEdge[edgeKeyTwo]) return false
          usedEdge[edgeKeyOne] = true
          usedEdge[edgeKeyTwo] = true
        }
      }
    }
  }
  return true
}

type Floor = MeshBuildingFloorPlans["floors"][0]

function makeEmptyFloorFromOutline(
  outlines: PolygonWithHolesXY[],
  floorId: string,
): {
  floor: Floor
  units: Unit[]
} {
  const graph: Graph = { edges: {}, vertices: {} }
  const spaces: Spaces = {}
  const units: Unit[] = []

  for (const outline of outlines) {
    const spacePolygon: string[] = []
    for (const point of outline.polygon) {
      const vertexId = randomId()
      graph.vertices[vertexId] = { id: vertexId, ...point }
      spacePolygon.push(vertexId)
    }
    const n = spacePolygon.length
    for (let i = 0; i < n; i++) {
      const v0 = spacePolygon[i]
      const v1 = spacePolygon[(i + 1) % n]
      const edgeId = randomId()
      graph.edges[edgeId] = { id: edgeId, start: v0, end: v1 }
    }

    const spaceHoles: string[][] = []
    for (const hole of outline.holes) {
      const spaceHole: string[] = []
      for (const point of hole) {
        const vertexId = randomId()
        graph.vertices[vertexId] = { id: vertexId, ...point }
        spaceHole.push(vertexId)
      }
      const m = spaceHole.length
      for (let i = 0; i < n; i++) {
        const v0 = spaceHole[i]
        const v1 = spaceHole[(i + 1) % m]
        const edgeId = randomId()
        graph.edges[edgeId] = { id: edgeId, start: v0, end: v1 }
      }
      spaceHoles.push(spaceHole)
    }

    const spaceId = randomId()
    spaces[spaceId] = { id: spaceId, polygon: spacePolygon, holes: spaceHoles }
    const unitId = randomId()
    const unit: Unit = { id: unitId, program: undefined, spaces: [{ floorId: floorId, spaceId: spaceId }] }
    units.push(unit)
  }
  return { floor: { id: floorId, graph, spaces }, units }
}

export function emptySelectedFloors(
  buildingFloorPlans: MeshBuildingFloorPlans,
  floorNumbers: number[],
  fixedFloors: FixedFloor[],
): MeshBuildingFloorPlans {
  const newUnits: Unit[] = []
  const updatedFloors = buildingFloorPlans.floors.map((floor, i) => {
    if (!floorNumbers.includes(i)) return floor
    const { floor: emptyFloor, units: floorUnits } = makeEmptyFloorFromOutline(fixedFloors[i].outline, floor.id)
    newUnits.push(...floorUnits)
    return emptyFloor
  })

  const filteredUnits = buildingFloorPlans.units
    .map((unit) => {
      const spaces = unit.spaces.filter((space) => {
        const floor = updatedFloors.find((floor) => floor.id === space.floorId)
        if (floor === undefined) return false
        return !!floor.spaces[space.spaceId]
      })
      return { ...unit, spaces }
    })
    .filter((unit) => unit.spaces.length > 0)

  const updatedUnits = [...filteredUnits, ...newUnits]

  return { floors: updatedFloors, units: updatedUnits }
}
