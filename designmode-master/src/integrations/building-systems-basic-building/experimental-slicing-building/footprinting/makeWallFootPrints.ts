import type { Floor } from "src/integrations/building-systems-basic-building/lib/types"
import { getVertexEdgeMap } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import { getWallShifts, getWallSideThicknessMap } from "./wallFootPrints"
import { getOuterAndInnerEdgeMap } from "./outerAndInnerEdges"
import type { PolygonXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  addVectorToPointXY,
  getUnitNormalVectorXY,
  getUnitVectorXY,
} from "src/integrations/building-systems-common/geometryHelpers"

type FootPrint = PolygonXY

const WallSettings = {
  outerThickness: 0.45,
  innerThickness: 0.15,
}
export const getWallFootprints = (floor: Floor): { id: string; footPrint: FootPrint }[] => {
  const graph = floor.graph
  const footPrints: { id: string; footPrint: FootPrint }[] = []

  const vertexEdgeMap = getVertexEdgeMap(graph)

  // const outerThickness = getOuterWallThicknessAndSurfaceColors(wallSettings, wallConfig).thickness
  const outerThickness = WallSettings.outerThickness
  // const innerThickness = getInnerWallThicknessAndSurfaceColors(wallSettings, wallConfig).thickness
  const innerThickness = WallSettings.innerThickness

  const outerAndInnerEdgeMap = getOuterAndInnerEdgeMap(floor)
  const edgeThicknessMap = getWallSideThicknessMap(outerAndInnerEdgeMap, outerThickness, innerThickness, graph)

  for (const edge of Object.values(graph.edges)) {
    const thickness = edgeThicknessMap[edge.id]
    const shifts = getWallShifts(edge, graph, vertexEdgeMap, thickness, edgeThicknessMap)

    const v0 = graph.vertices[edge.start]
    const v1 = graph.vertices[edge.end]

    const normalVector = getUnitNormalVectorXY(v0, v1)
    const unitVector = getUnitVectorXY(v0, v1)

    const pL0 = addVectorToPointXY(addVectorToPointXY(v0, normalVector, thickness.left), unitVector, shifts.v0LeftShift)
    const pR0 = addVectorToPointXY(
      addVectorToPointXY(v0, normalVector, -thickness.right),
      unitVector,
      shifts.v0RightShift,
    )

    const pL1 = addVectorToPointXY(addVectorToPointXY(v1, normalVector, thickness.left), unitVector, shifts.v1LeftShift)
    const pR1 = addVectorToPointXY(
      addVectorToPointXY(v1, normalVector, -thickness.right),
      unitVector,
      shifts.v1RightShift,
    )

    const footPrint: FootPrint = [pL0, v0, pR0, pR1, v1, pL1]

    footPrints.push({ id: edge.id, footPrint })
  }

  return footPrints
}
