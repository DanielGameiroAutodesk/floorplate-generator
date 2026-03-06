export type VertexEdgeMap = Record<string, string[]>
export type Vertex = { x: number; y: number; id: string }
export type Edge = { start: string; end: string; id: string }
export type Graph = { vertices: Vertices; edges: Edges }
export type Vertices = Record<string, Vertex>
export type Edges = Record<string, Edge>

export function getVertexEdgeMap(graph: Graph): VertexEdgeMap {
  const vertexEdgeMap: VertexEdgeMap = {}
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

export function splitGraphInConnectedSubGraphs(graph: Graph): Graph[] {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const visitedEdges: Record<string, boolean> = {}
  const subGraphs: Graph[] = []

  for (let edge of Object.values(edges)) {
    if (visitedEdges[edge.id]) continue
    const subGraphEdges: Record<string, Edge> = {}
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
    const subGraphVertices: Record<string, Vertex> = {}
    Object.values(subGraphEdges).forEach((subGraphEdge) => {
      subGraphVertices[subGraphEdge.start] = vertices[subGraphEdge.start]
      subGraphVertices[subGraphEdge.end] = vertices[subGraphEdge.end]
    })
    const subGraph = { edges: subGraphEdges, vertices: subGraphVertices }
    subGraphs.push(subGraph)
  }
  return subGraphs
}
