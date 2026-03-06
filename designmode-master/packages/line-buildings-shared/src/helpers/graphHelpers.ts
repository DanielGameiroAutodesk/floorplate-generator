import type { Graph } from "../shapeHelpers.js"

export function removeDuplicatesVerticesAndEdges(graph: Graph) {
  const { vertices, edges } = structuredClone(graph)
  const pointToVertexId: Record<string, string> = {}
  const vertexToVertex: Record<string, string> = {}
  Object.values(vertices).forEach((vertex) => {
    const point = `${vertex.x}-${vertex.y}`
    if (point in pointToVertexId) {
      vertexToVertex[vertex.id] = pointToVertexId[point]
    } else {
      pointToVertexId[point] = vertex.id
    }
  })
  Object.values(edges).forEach((edge) => {
    if (edge.start in vertexToVertex) edge.start = vertexToVertex[edge.start]
    if (edge.end in vertexToVertex) edge.end = vertexToVertex[edge.end]
  })
  Object.keys(vertexToVertex).forEach((vertexId) => {
    delete vertices[vertexId]
  })
  const usedEdges: Record<string, boolean> = {}
  const edgesToDelete: string[] = []
  Object.values(edges).forEach((edge) => {
    if (edge.start + edge.end in usedEdges) edgesToDelete.push(edge.id)
    usedEdges[edge.start + edge.end] = true
    usedEdges[edge.end + edge.start] = true
  })
  Object.values(edges).forEach((edge) => {
    if (edge.start === edge.end) edgesToDelete.push(edge.id)
  })
  edgesToDelete.forEach((edgeID) => {
    delete edges[edgeID]
  })
  return { vertices, edges }
}
