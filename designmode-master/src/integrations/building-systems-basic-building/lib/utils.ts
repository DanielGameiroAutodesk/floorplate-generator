import type { Urn } from "@spacemakerai/element-types"
import type { BasicBuilding, Floor, Space, Unit } from "./types"
import type { Graph } from "./graph/graph"
import type { PolygonWithHolesXY } from "./geometry/geometry"
import { calculateUnionOfPolygonsWithHoles } from "./geometry/geometry"

export const round = (value: number, decimalPlaces: number): number =>
  Math.round((value + Number.EPSILON) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)

const buffer = new BigUint64Array(1)
export function randomId(): string {
  return crypto.getRandomValues(buffer)[0].toString(36).substring(0, 10)
}

export function parseUrn(urn: Urn) {
  const [, , system, authcontext, id, revision] = urn.split(":")
  return { system, id, revision, authcontext }
}

export function getPolygonWithHolesFromSpace(space: Space, graph: Graph): PolygonWithHolesXY {
  return {
    polygon: space.polygon.map((v) => graph.vertices[v]),
    holes: space.holes.map((h) => h.map((v) => graph.vertices[v])),
  }
}

export function getUnitLookup(units: Unit[]) {
  const map: Record<string, Record<string, Unit>> = {}
  for (const unit of units) {
    for (const ref of unit.spaces) {
      if (!map[ref.floorId]) {
        map[ref.floorId] = {}
      }
      map[ref.floorId][ref.spaceId] = unit
    }
  }
  return (floorId: string, spaceId: string): Unit | undefined => map[floorId]?.[spaceId]
}

export function cleanupDeadUnitRefs(units: Unit[], floors: Floor[]) {
  return units
    .map((unit) => {
      const refs = unit.spaces.filter((ref) =>
        floors.some((floor) => floor.id === ref.floorId && floor.spaces[ref.spaceId]),
      )
      return { ...unit, spaces: refs }
    })
    .filter((unit) => unit.spaces.length > 0)
}

export type FootPrint = PolygonWithHolesXY[]

export function getFloorFootPrintsInBuilding(building: BasicBuilding): FootPrint[] {
  const footPrints: FootPrint[] = []
  for (const floor of building.floors) {
    const footPrint = calculateUnionOfPolygonsWithHoles(
      Object.values(floor.spaces).map((space) => getPolygonWithHolesFromSpace(space, floor.graph)),
    )
    footPrints.push(footPrint)
  }
  return footPrints
}

export function validateBuilding(building: BasicBuilding) {
  const validationErrors: string[] = []
  // all spaces have units
  const unitLookup = getUnitLookup(building.units)
  for (const floor of building.floors) {
    for (const space of Object.values(floor.spaces)) {
      if (!unitLookup(floor.id, space.id)) {
        validationErrors.push(`missing unit for space! ${floor.id} ${space.id}`)
      }
    }
  }
  // check unit space refs
  for (const unit of building.units) {
    for (const { floorId, spaceId } of unit.spaces) {
      const floor = building.floors.find((f) => f.id === floorId)
      if (!floor) {
        validationErrors.push(`dead floor pointer in unit! unit: ${unit.id} floor: ${floorId}`)
      } else if (!floor.spaces[spaceId]) {
        validationErrors.push(`dead space pointer in unit! unit: ${unit.id} floor: ${floorId}`)
      }
    }
  }

  // all space vertices exists in graph
  for (const floor of building.floors) {
    for (const space of Object.values(floor.spaces)) {
      if (space.polygon.length === 0) {
        validationErrors.push(`space has no polygon! floor: ${floor.id} space: ${space.id}`)
      }
      for (const vertexId of space.polygon) {
        if (!floor.graph.vertices[vertexId]) {
          validationErrors.push(
            `dead vertex pointer in space! floor: ${floor.id} space: ${space.id} vertex: ${vertexId}`,
          )
        }
      }
      for (const hole of space.holes) {
        for (const vertexId of hole) {
          if (!floor.graph.vertices[vertexId]) {
            validationErrors.push(
              `dead vertex pointer in hole! floor: ${floor.id} space: ${space.id} vertex: ${vertexId}`,
            )
          }
        }
      }
    }
  }

  // all vertex references in edges exists in graph
  for (const floor of building.floors) {
    for (const edge of Object.values(floor.graph.edges)) {
      for (const vertexId of [edge.end, edge.start]) {
        if (!floor.graph.vertices[vertexId]) {
          validationErrors.push(`dead vertex pointer in edge! floor: ${floor.id} edge: ${edge.id}`)
        }
      }
    }
  }

  // every floor has at least one space
  for (const floor of building.floors) {
    if (floor.height <= 0) {
      validationErrors.push(`floor has no height! floor: ${floor.id}`)
    }
    if (Object.keys(floor.spaces).length === 0) {
      validationErrors.push(`floor has no spaces! floor: ${floor.id}`)
    }
  }

  if (building.floors.length === 0) {
    validationErrors.push(`building has no floors!`)
  }

  return validationErrors
}
