import type { Graph, GraphEdge, GraphVertex } from "../../shapeHelpers.js"

export function getVertexEdgeMap(graph: Graph) {
  const vertexEdgeMap: Record<string, string[]> = {}
  Object.keys(graph.vertices).forEach((vertexID) => {
    vertexEdgeMap[vertexID] = []
  })
  Object.entries(graph.edges).forEach(([edgeID, edge]) => {
    const startVertex = edge.start
    const endVertex = edge.end
    vertexEdgeMap[startVertex].push(edgeID)
    vertexEdgeMap[endVertex].push(edgeID)
  })
  return vertexEdgeMap
}

export function splitGraphInConnectedSubGraphs(graph: Graph) {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const visitedEdges: Record<string, boolean> = {}
  const subGraphs = []

  for (let edge of Object.values(edges)) {
    if (visitedEdges[edge.id]) continue
    const subGraphEdges: Record<string, GraphEdge> = {}
    let edgeList = [edge.id]
    while (edgeList.length > 0) {
      let nextEdgeList = []
      for (let edgeID of edgeList) {
        if (visitedEdges[edgeID]) continue
        visitedEdges[edgeID] = true
        subGraphEdges[edgeID] = edges[edgeID]
        nextEdgeList.push(...vertexEdgeMap[edges[edgeID].start], ...vertexEdgeMap[edges[edgeID].end])
      }
      edgeList = nextEdgeList
    }
    const subGraphVertices: Record<string, GraphVertex> = {}
    Object.values(subGraphEdges).forEach((subGraphEdge) => {
      subGraphVertices[subGraphEdge.start] = vertices[subGraphEdge.start]
      subGraphVertices[subGraphEdge.end] = vertices[subGraphEdge.end]
    })
    const subGraph = { edges: subGraphEdges, vertices: subGraphVertices }
    subGraphs.push(subGraph)
  }
  return subGraphs
}

export function getLinesFromGraph(graph: Graph) {
  const { edges, vertices } = graph
  return Object.values(edges).map((edge) => {
    const startPoint = vertices[edge.start]
    const endPoint = vertices[edge.end]
    return [startPoint, endPoint]
  })
}
