import type {
  FloorFootPrintByBuildingMap,
  FootPrint,
} from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import type { BasicPlusBuilding } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanSketcher"
import { doOuterShapesMatch } from "./compareOuterShapes"
import type { FloorTemplate } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlansSwapMenu/FloorPlanTemplatesList"
import { cleanupDeadUnitRefs, randomId } from "src/integrations/building-systems-basic-building/lib/utils"
import type { Floor, Space, Spaces, Unit } from "src/integrations/building-systems-basic-building/lib/types"
import type { Graph, Vertex, Vertices } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type { PointXY } from "src/lib/geometry/polygonXY"

function rotateAndTranslateVertex(vertex: Vertex, rotation: PointXY, translation: PointXY): Vertex {
  const xr = vertex.x * rotation.x - vertex.y * rotation.y
  const yr = vertex.y * rotation.x + vertex.x * rotation.y
  const xrt = xr + translation.x
  const yrt = yr + translation.y
  return { x: xrt, y: yrt, id: vertex.id }
}
function rotateAndTransformGraph(graph: Graph, rotation: PointXY, translation: PointXY): Graph {
  const vertices: Vertices = {}
  for (const vertex of Object.values(graph.vertices)) {
    vertices[vertex.id] = rotateAndTranslateVertex(vertex, rotation, translation)
  }
  return { ...graph, vertices }
}

function rotateAndTransformSpaceVertexUnits(
  spaceVertexUnits: FloorTemplate["spaceVertexUnits"],
  rotation: PointXY,
  translation: PointXY,
): FloorTemplate["spaceVertexUnits"] {
  return spaceVertexUnits.map((spaceVertexUnit) => {
    const polygon = spaceVertexUnit.polygon.map((vertex) => rotateAndTranslateVertex(vertex, rotation, translation))
    const holes = spaceVertexUnit.holes.map((hole) =>
      hole.map((vertex) => rotateAndTranslateVertex(vertex, rotation, translation)),
    )
    return { ...spaceVertexUnit, polygon, holes }
  })
}
export function alignFloorTemplateWithOuterShape(floorTemplate: FloorTemplate, outerShape: FootPrint) {
  const match = doOuterShapesMatch(outerShape, floorTemplate.footPrint)
  if (!match.match) return undefined

  const graph = rotateAndTransformGraph(floorTemplate.graph, match.rotation, match.translation)
  const spaceVertexUnits = rotateAndTransformSpaceVertexUnits(
    floorTemplate.spaceVertexUnits,
    match.rotation,
    match.translation,
  )

  return { ...floorTemplate, graph, spaceVertexUnits }
}
export function getUpdatedBuildingsAfterApplyingTemplate(
  template: FloorTemplate,
  floorFootPrintsByBuildings: FloorFootPrintByBuildingMap,
  basicBuildings: BasicPlusBuilding[],
): Record<string, BasicPlusBuilding> {
  const updatedBuildings: Record<string, BasicPlusBuilding> = {}
  for (const building of basicBuildings) {
    let updateBuilding = false
    const floorFootPrints = floorFootPrintsByBuildings[building.id]
    const alignedFloorTemplates: (FloorTemplate | undefined)[] = []
    for (let i = 0; i < floorFootPrints.length; i++) {
      if (building.selectedFloors && !building.selectedFloors[i]) {
        alignedFloorTemplates.push(undefined)
        continue
      }
      const footPrint = floorFootPrints[i]
      const alignedFloorTemplate = alignFloorTemplateWithOuterShape(template, footPrint)
      if (alignedFloorTemplate !== undefined) updateBuilding = true
      alignedFloorTemplates.push(alignedFloorTemplate)
    }
    if (!updateBuilding) continue

    const updatedFloors: Floor[] = []
    const newUnits: Unit[] = []
    for (let i = 0; i < building.floors.length; i++) {
      const alignedFloorTemplate = alignedFloorTemplates[i]
      const floor = building.floors[i]
      if (alignedFloorTemplate === undefined) {
        updatedFloors.push(floor)
        continue
      }

      const updatedGraph: Graph = alignedFloorTemplate.graph
      const updatedSpaces: Spaces = {}
      for (const spaceVertexUnit of alignedFloorTemplate.spaceVertexUnits) {
        const space: Space = {
          id: randomId(),
          polygon: spaceVertexUnit.polygon.map((vertex) => vertex.id),
          holes: spaceVertexUnit.holes.map((hole) => hole.map((vertex) => vertex.id)),
          program: undefined,
        }
        updatedSpaces[space.id] = space
        const unit: Unit = {
          id: randomId(),
          spaces: [{ floorId: floor.id, spaceId: space.id }],
          program: spaceVertexUnit.program === "UNASSIGNED" ? undefined : (spaceVertexUnit.program as Unit["program"]),
        }
        newUnits.push(unit)
      }
      const updatedFloor: Floor = { ...floor, spaces: updatedSpaces, graph: updatedGraph }
      updatedFloors.push(updatedFloor)
    }

    const updatedUnits = cleanupDeadUnitRefs(building.units, updatedFloors)
    updatedUnits.push(...newUnits)

    updatedBuildings[building.id] = { ...building, floors: updatedFloors, units: updatedUnits }
  }
  return updatedBuildings
}
