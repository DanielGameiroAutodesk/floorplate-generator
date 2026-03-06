import type { Edges, Graph, VertexPolygonWithHoles, Vertices } from "./graph"
import { makeRandomId } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/utils"

export function makeGraphFromVertexPolygonWithHoles(vertexPolygonWithHoles: VertexPolygonWithHoles): Graph {
  const vertices: Vertices = {}
  const edges: Edges = {}
  const polygon = vertexPolygonWithHoles.polygon
  for (let i = 0; i < polygon.length; i++) {
    const vertexOne = polygon[i]
    const vertexTwo = polygon[(i + 1) % polygon.length]
    vertices[vertexOne.id] = vertexOne
    const edgeId = makeRandomId()
    edges[edgeId] = { id: edgeId, start: vertexOne.id, end: vertexTwo.id }
  }

  const holes = vertexPolygonWithHoles.holes
  for (const hole of holes) {
    for (let i = 0; i < hole.length; i++) {
      const vertexOne = hole[i]
      const vertexTwo = hole[(i + 1) % hole.length]
      vertices[vertexOne.id] = vertexOne
      const edgeId = makeRandomId()
      edges[edgeId] = { id: edgeId, start: vertexOne.id, end: vertexTwo.id }
    }
  }
  return { vertices, edges }
}
