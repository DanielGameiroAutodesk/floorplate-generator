import { isDefined } from "src/lib/array"

import { fillCellWithExploreLayoutType } from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/exploreLayoutTypes"
import { getGraphBuildings3000 } from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/buildify"
import { cleanGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/graphHelpers"

export type Polygon = [number, number][]

type Vertex = { x: number; y: number; id: string }
type Edge = { start: string; end: string; id: string }
type Vertices = { [id: string]: Vertex }
type Edges = { [id: string]: Edge }
export type SimpleGraph = {
  vertices: Vertices
  edges: Edges
}

export const supportedTechniques = [
  "closedCityBlock",
  "openCityBlock",
  "twoAngled",
  "oneAngled",
  "fanBuildings",
  "eTypeLamellas",
  "oneAngledTower",
  "openCityBlockPointHouseMix",
  "smileyBlock",
  "cityBlocksWithGaps",
  "POINT_BUILDINGS",
  "shiftedPointBuildings",
  "randomizedBuildings",
  "shiftedShortLamellas",
  "blank",
] as const

export type Technique = (typeof supportedTechniques)[number]

export type ExploreLinearBuilding = { type: "linear"; polygons: Polygon[]; graph: SimpleGraph; width: number }
export type ExplorePolygonalBuilding = { type: "polygonal"; polygons: Polygon[] }
export type ExploreBuilding = ExploreLinearBuilding | ExplorePolygonalBuilding

export function fillPolygonWithTechnique(
  polygon: Polygon,
  technique: Technique,
  stories: number,
  buildingWidth: number,
  towerWidth: number,
): ExploreBuilding[] {
  type GraphBuildingVertex = { x: number; y: number; id: string }
  type GraphBuildingEdge = { start: string; end: string; id: string; shiftFactor?: number; width?: number }
  type GraphBuildingSimpleGraph = {
    vertices: { [id: string]: GraphBuildingVertex }
    edges: { [id: string]: GraphBuildingEdge }
  }
  type ExploreGraphBuilding = {
    graph: GraphBuildingSimpleGraph
    graphExteriors: Record<string, Polygon>
  }

  const graph = fillCellWithExploreLayoutType(polygon, technique, stories, buildingWidth, towerWidth)
  cleanGraph(graph)

  const extractBuildingWidth = (gb: ExploreGraphBuilding): number => {
    const widthValues = new Set(
      Object.values(gb.graph.edges)
        .map((e) => e.width)
        .filter(isDefined),
    )
    return widthValues.size == 1 ? widthValues.values().next().value! : buildingWidth
  }

  const graphBuildings: ExploreGraphBuilding[] = getGraphBuildings3000(graph)
  return graphBuildings.map((gb): ExploreBuilding => {
    // The "shiftedShortLamellas" generator produces edges with a "shiftFactor" (indicating the offset
    // sections). Line Buildings don't currently support this, so then we make Basic Buildings instead
    const compatibleWithLineBuilding = Object.values(gb.graph.edges).every((edge) => !edge.shiftFactor)
    if (compatibleWithLineBuilding) {
      return {
        type: "linear",
        polygons: Object.values(gb.graphExteriors),
        graph: cleanGraphForLinearBuilding(gb.graph),
        width: extractBuildingWidth(gb),
      }
    } else {
      return { type: "polygonal", polygons: Object.values(gb.graphExteriors) }
    }
  })
}

/**
 * Take a SimpleGraph representation of a "graph building" produced by the Explore code and convert
 * it to a cleaned-up graph representation that works robustly as a Line Building graph. (The graphs
 * provided as input might have edges that arbitrarily point either in the forward and backward
 * direction as you traverse the graph building, whereas the Line Building representation requires
 * that all the edges are pointed in the same direction along the line.)
 */
function cleanGraphForLinearBuilding(graph: SimpleGraph): SimpleGraph {
  const vertexEdgeMap: Record<string, string[]> = {}
  Object.keys(graph.vertices).forEach((vertexId) => (vertexEdgeMap[vertexId] = []))
  Object.entries(graph.edges).forEach(([edgeId, edge]) => {
    vertexEdgeMap[edge.start].push(edgeId)
    vertexEdgeMap[edge.end].push(edgeId)
  })
  const openVertexIdIfNotClosedLoop = Object.keys(vertexEdgeMap).find((vertexID) => vertexEdgeMap[vertexID].length == 1)
  const startVertexId = openVertexIdIfNotClosedLoop ?? Object.keys(vertexEdgeMap)[0]

  const vertices: SimpleGraph["vertices"] = {}
  const edges: SimpleGraph["edges"] = {}

  const addedEdgeIds = new Set<string>()
  const addedVertexIds = new Set<string>()
  let currentVertexId: string | undefined = startVertexId
  while (currentVertexId !== undefined) {
    const vertex = graph.vertices[currentVertexId]
    vertices[vertex.id] = { id: vertex.id, x: vertex.x, y: vertex.y }
    addedVertexIds.add(currentVertexId)

    const unusedEdgesForVertex: string[] = vertexEdgeMap[currentVertexId].filter((edgeId) => !addedEdgeIds.has(edgeId))
    if (unusedEdgesForVertex.length == 0) {
      break
    }
    const edgeId = unusedEdgesForVertex[0]
    const edge = graph.edges[edgeId]
    const otherVertexId: string = edge.start != currentVertexId ? edge.start : edge.end

    edges[edgeId] = { id: edgeId, start: currentVertexId, end: otherVertexId }
    addedEdgeIds.add(edgeId)

    currentVertexId = addedVertexIds.has(otherVertexId) ? undefined : otherVertexId
  }

  return { vertices, edges }
}
