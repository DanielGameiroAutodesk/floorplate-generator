// import { SimpleUnit } from "../../../simpleBuildings/simpleBuilding"
import {
  _addCloseVerticesToEdges,
  _removeDuplicatedEdges,
  _removeDuplicatedVertices,
  _removeUnusedVertices,
  _snapCloseVertices,
} from "./graphMutations"
import type { Graph } from "./graph"
import type { Polygon } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/geometry/geometry"
import type { SimpleUnit } from "src/integrations/building-systems-common/buildingMigrations/toSimpleBuildingWithParking"

function makeRandomId() {
  return Math.random().toString(36).substring(2)
}

const _makeWallGraphOfLoopInline = (graph: Graph, loop: Polygon) => {
  const n = loop.length
  const vertexList = loop
    .map((point) => {
      const [x, y] = point
      return { id: makeRandomId(), x, y }
    })
    .filter((vertex, i, list) => {
      const nextVertex = list[(i + 1) % n]
      return vertex.x !== nextVertex.x || vertex.y !== nextVertex.y
    })
  vertexList.forEach((vertex) => {
    graph.vertices[vertex.id] = vertex
  })

  const m = vertexList.length
  for (let i = 0; i < m; i++) {
    const start = vertexList[i].id
    const end = vertexList[(i + 1) % m].id
    const edgeID = makeRandomId()
    graph.edges[edgeID] = { id: edgeID, start, end }
  }
}
export function makeGraphFromUnits(units: SimpleUnit[]) {
  const wallGraph: Graph = { edges: {}, vertices: {} }
  for (const unit of units) {
    _makeWallGraphOfLoopInline(wallGraph, unit.polygon)
    for (const hole of unit.holes) {
      _makeWallGraphOfLoopInline(wallGraph, hole)
    }
  }

  _snapCloseVertices(wallGraph)
  _removeDuplicatedVertices(wallGraph)
  _removeDuplicatedEdges(wallGraph)
  _removeUnusedVertices(wallGraph)

  _addCloseVerticesToEdges(wallGraph)
  _removeDuplicatedEdges(wallGraph)
  _removeUnusedVertices(wallGraph)
  return wallGraph
}
