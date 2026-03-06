import {
  splitGraphInOldAndNewSectionFormat,
  updateAutoSections,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/apartments/sections.js"
import { cleanGraph } from "./graphHelpers.js"
import { addDefaultPropsToGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/misc/utils.js"
import { findConnectedEdges } from "src/integrations/building-systems-site-study/generator/sketchStuff/sharedDivisionLinesV2/graphHelpers.js"
import { buildingPolygonsFromGraph2 } from "./buildingsFromGraph.js"

function directEdgesToHaveCoresFacingNorth(edges, vertices) {
  const newEdges = { ...edges }
  Object.values(edges).forEach((edge) => {
    const startVertex = vertices[edge.start]
    const endVertex = vertices[edge.end]
    if (startVertex.x < endVertex.x) {
      newEdges[edge.id] = { ...edge, start: endVertex.id, end: startVertex.id }
    }
  })
  return newEdges
}

function buildifyGraph(buildingGraph) {
  const withProps = addDefaultPropsToGraph(buildingGraph)
  const withDirectedApts = {
    vertices: withProps.vertices,
    edges: directEdgesToHaveCoresFacingNorth(withProps.edges, withProps.vertices),
  }
  cleanGraph(withDirectedApts)
  const withUpdatedSections = updateAutoSections(withDirectedApts)
  return withUpdatedSections
}

function updateNumberOfFloorStacks(_graph) {
  const { newGraph } = splitGraphInOldAndNewSectionFormat(_graph)
  return newGraph
}

export function getGraphBuildings3000(buildingGraph) {
  const buildifiedGraph = buildifyGraph(buildingGraph)
  return findConnectedEdges(buildifiedGraph).map((g) => {
    const syncedGraph1 = updateAutoSections(g)
    const syncedGraph = updateNumberOfFloorStacks(syncedGraph1)
    const graphBuildings = buildingPolygonsFromGraph2(syncedGraph)
    return {
      graph: syncedGraph,
      graphExteriors: graphBuildings.reduce((acc, b) => {
        acc[b.id] = b.polygon
        return acc
      }, {}),
    }
  })
}
