import type {
  PolygonWithHolesXY,
  PolygonXY,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  _addCloseVerticesToEdges,
  _removeDuplicatedEdges,
  _removeDuplicatedVertices,
  _removeUnusedVertices,
  _snapCloseVertices,
} from "./graphMutations"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"

import type { Graph } from "./graph"

const _makeWallGraphOfLoopInline = (graph: Graph, loop: PolygonXY) => {
  const n = loop.length
  const vertexList = loop
    .map((point) => {
      const { x, y } = point
      return { id: randomId(), x, y }
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
    const edgeID = randomId()
    graph.edges[edgeID] = { id: edgeID, start, end }
  }
}
export function makeGraphFromSpaces(spaces: PolygonWithHolesXY[]) {
  const graph: Graph = { vertices: {}, edges: {} }
  for (const space of spaces) {
    _makeWallGraphOfLoopInline(graph, space.polygon)
    for (const hole of space.holes) {
      _makeWallGraphOfLoopInline(graph, hole)
    }
  }

  _snapCloseVertices(graph)
  _removeDuplicatedVertices(graph)
  _removeDuplicatedEdges(graph)
  _removeUnusedVertices(graph)

  _addCloseVerticesToEdges(graph)
  _removeDuplicatedEdges(graph)
  _removeUnusedVertices(graph)
  return graph
}
