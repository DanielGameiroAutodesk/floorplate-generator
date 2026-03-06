import type { Graph, VertexPolygon, VertexPolygonWithHoles } from "./graph/graph"
import { getIntersectionAreaOfPolygonsWithHoles } from "./geometry/areaOfPolygonIntersection"
import { makeGraphFromUnits } from "./graph/makeGraphFromUnits"
import { findPolygonsWithHolesInGraph } from "./graph/findPolygonsWithHolesInGraph"
import { makeRandomId } from "./utils"
import { removeDuplicateLastPoint } from "./geometry/geometry"
import { makeGraphFromVertexPolygonWithHoles } from "./graph/makeGraphFromVertexPolygonWithHoles"
import { mapStructureTypeToUnitProgram } from "src/integrations/building-systems-basic-building/floorPlansMenu/mappingTypes"
import type {
  BasicBuilding,
  Floor,
  Space,
  Spaces,
  Unit,
} from "src/integrations/building-systems-basic-building/lib/types"
import type {
  SimpleBuilding,
  SimpleUnit,
} from "src/integrations/building-systems-common/buildingMigrations/toSimpleBuildingWithParking"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"

function getSimpleUnitWithMostOverlappingArea(spacePolygon: VertexPolygonWithHoles, simpleUnits: SimpleUnit[]) {
  let maxArea = 1e-3
  let bestFittingSimpleUnit: SimpleUnit | undefined
  for (const simpleUnit of simpleUnits) {
    const polygon = simpleUnit.polygon.map(([x, y]) => ({ x, y }))
    const holes = simpleUnit.holes.map((hole) => hole.map(([x, y]) => ({ x, y })))
    const area = getIntersectionAreaOfPolygonsWithHoles(spacePolygon, { polygon, holes })
    if (area > maxArea) {
      maxArea = area
      bestFittingSimpleUnit = simpleUnit
    }
  }
  return bestFittingSimpleUnit
}

export function getGraphModelFromUnitModel(floorId: string, oldUnits: SimpleUnit[], functionId?: string) {
  const graph = makeGraphFromUnits(oldUnits)
  const polygonsWithHoles = findPolygonsWithHolesInGraph(graph)

  const spaces: Record<string, Space> = {}
  const units: Unit[] = []
  for (const polygonWithHoles of polygonsWithHoles) {
    const polygon = polygonWithHoles.polygon
    const holes = polygonWithHoles.holes

    const bestFittingSimpleUnit = getSimpleUnitWithMostOverlappingArea(polygonWithHoles, oldUnits)
    if (bestFittingSimpleUnit === undefined) continue
    const unitProgram = mapStructureTypeToUnitProgram(bestFittingSimpleUnit?.type)

    const spaceId = makeRandomId()
    spaces[spaceId] = {
      id: spaceId,
      polygon: polygon.map((v) => v.id),
      holes: holes.map((hole) => hole.map((v) => v.id)),
      program: undefined,
    }
    if (bestFittingSimpleUnit?.type === "PARKING") {
      const parkingParams = bestFittingSimpleUnit.params
      const unit: Unit = {
        id: makeRandomId(),
        spaces: [{ floorId, spaceId }],
        program: unitProgram,
        generator: { generatorId: "parking", params: parkingParams },
      }
      units.push(unit)
    } else {
      units.push({ id: makeRandomId(), spaces: [{ floorId, spaceId }], program: unitProgram, functionId })
    }
  }

  return { graph, spaces, units }
}

export function createBasicBuildingFromSimpleBuilding(simpleBuilding: SimpleBuilding): BasicBuilding {
  const floors: Floor[] = []
  const units: Unit[] = []
  for (const simpleFloor of simpleBuilding.floors) {
    const height = simpleFloor.height
    let spaces: Spaces = {}
    let graph: Graph = { vertices: {}, edges: {} }
    const floorId = randomId()
    if (simpleFloor.content || simpleFloor.outerShapes.length > 1) {
      const simpleUnits =
        simpleFloor.content?.units ||
        simpleFloor.outerShapes.map((outerShape) => {
          return {
            id: makeRandomId(),
            polygon: outerShape.polygon,
            holes: outerShape.holes,
            type: undefined,
            params: {},
          }
        })

      const graphModelOfFloor = getGraphModelFromUnitModel(floorId, simpleUnits, simpleFloor.functionId)
      graph = graphModelOfFloor.graph
      spaces = graphModelOfFloor.spaces
      units.push(...graphModelOfFloor.units)
    } else {
      for (let outerShape of simpleFloor.outerShapes) {
        const spaceId = makeRandomId()
        const polygon: VertexPolygon = removeDuplicateLastPoint(outerShape.polygon).map(([x, y]) => {
          return { x, y, id: makeRandomId() }
        })
        const holes: VertexPolygon[] = outerShape.holes.map((hole) =>
          removeDuplicateLastPoint(hole).map(([x, y]) => {
            return { x, y, id: makeRandomId() }
          }),
        )
        spaces[spaceId] = {
          id: spaceId,
          polygon: polygon.map((v) => v.id),
          holes: holes.map((hole) => hole.map((v) => v.id)),
        }
        units.push({
          id: makeRandomId(),
          spaces: [{ floorId, spaceId }],
          program: undefined,
          functionId: simpleFloor.functionId,
        })
        graph = makeGraphFromVertexPolygonWithHoles({ polygon, holes })
      }
    }
    const floor: Floor = { id: floorId, graph, spaces, height }
    floors.push(floor)
  }
  return { floors, units }
}
