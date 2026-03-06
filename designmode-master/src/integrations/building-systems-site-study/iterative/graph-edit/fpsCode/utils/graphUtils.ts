type Edge = { start: string; end: string; id: string }
type Vertex = { x: number; y: number; id: string }

export type WallGraph = {
  edges: Record<string, Edge>
  vertices: { [key: string]: Vertex }
}

export function getVertexEdgeMap(graph: WallGraph) {
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

export function mutSnapVertices(vertices: Record<string, Vertex>, distance: number = 5e-3) {
  const sortedVertices = Object.values(vertices).sort((a, b) => a.x - b.x || a.y - b.y)
  const n = sortedVertices.length
  let otherIndexStart = 0
  for (let i = 0; i < n; i++) {
    const vertexOne = sortedVertices[i]
    for (let j = otherIndexStart; j < i; j++) {
      const vertexTwo = sortedVertices[j]
      if (vertexOne.x - vertexTwo.x > distance) {
        otherIndexStart = j + 1
      }
      const dist = ((vertexOne.x - vertexTwo.x) ** 2 + (vertexOne.y - vertexTwo.y) ** 2) ** 0.5
      if (dist < distance) {
        vertexOne.x = vertexTwo.x
        vertexOne.y = vertexTwo.y
        break
      }
    }
  }
}

export function _snapCloseVertices(graph: WallGraph) {
  const { vertices } = graph

  mutSnapVertices(vertices)
  _removeDuplicatedVertices(graph)
  _removeDuplicatedEdges(graph)
  _removeZeroEdges(graph)
}

export function _removeEdgesWithSameStartAndEnd(graph: WallGraph) {
  const { edges } = graph
  const edgeIDs = Object.keys(graph.edges)
  const n = edgeIDs.length
  for (let i = 0; i < n; i++) {
    const edgeID = edgeIDs[i]
    const edge = edges[edgeID]
    if (edge.start === edge.end) delete edges[edgeID]
  }
  return graph
}

export function _removeUnusedVertices(graph: WallGraph) {
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const { vertices } = graph
  Object.keys(vertexEdgeMap).forEach((vertexID) => {
    if (vertexEdgeMap[vertexID].length === 0) delete vertices[vertexID]
  })
}

export function _removeDuplicatedEdges(graph: WallGraph) {
  const edgeList = Object.values(graph.edges)
  const n = edgeList.length
  for (let i = 0; i < n; i++) {
    const edgeOne = edgeList[i]
    for (let j = i + 1; j < n; j++) {
      const edgeTwo = edgeList[j]
      if (
        (edgeOne.start === edgeTwo.start && edgeOne.end === edgeTwo.end) ||
        (edgeOne.start === edgeTwo.end && edgeOne.end === edgeTwo.start)
      ) {
        delete graph.edges[edgeOne.id]
        break
      }
    }
  }
  return graph
}

export function _removeZeroEdges(graph: WallGraph) {
  const edgeList = Object.values(graph.edges)
  const n = edgeList.length
  for (let i = 0; i < n; i++) {
    const edgeOne = edgeList[i]
    if (edgeOne.start === edgeOne.end) {
      delete graph.edges[edgeOne.id]
    }
  }
  return graph
}

export function _removeDuplicatedVertices(graph: WallGraph) {
  const { vertices, edges } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const vertexIDs = Object.keys(graph.vertices)

  const sortedVertices = Object.values(vertices).sort((a, b) => a.x - b.x || a.y - b.y)
  const n = vertexIDs.length
  let otherIndexStart = 0
  for (let i = 0; i < n; i++) {
    const vertexOne = sortedVertices[i]
    for (let j = otherIndexStart; j < i; j++) {
      const vertexTwo = sortedVertices[j]
      if (!vertexTwo) continue
      if (vertexOne.x !== vertexTwo.x) {
        otherIndexStart = j + 1
      }
      if (vertexOne.x === vertexTwo.x && vertexOne.y === vertexTwo.y) {
        const vertexOneID = vertexOne.id
        const vertexTwoID = vertexTwo.id
        delete vertices[vertexOneID]
        const edgeIDs = vertexEdgeMap[vertexOneID]
        edgeIDs.forEach((edgeID) => {
          const edge = edges[edgeID]
          if (edge.start === vertexOneID) edge.start = vertexTwoID
          if (edge.end === vertexOneID) edge.end = vertexTwoID
        })
        break
      }
    }
  }
  return graph
}

export function getLinesFromGraph(graph: WallGraph) {
  const { edges, vertices } = graph
  return Object.values(edges).map((edge) => {
    const startPoint = vertices[edge.start]
    const endPoint = vertices[edge.end]
    return [startPoint, endPoint]
  })
}

export function getLoopFromGraphStartingInEdge(graph: WallGraph, vertexOneID: string, vertexTwoId: string) {
  const { vertices, edges } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const loop = [vertexOneID, vertexTwoId]
  let prevVertexID = vertexOneID
  let currentVertexID = vertexTwoId
  let nextVertexID
  const n = 1000 // avoid infinite looping
  for (let i = 0; i < n; i++) {
    const anglesAndEdgeIDs = vertexEdgeMap[currentVertexID]
      .map((edgeID) => {
        const edge = edges[edgeID]
        const otherVertexID = edge.start === currentVertexID ? edge.end : edge.start
        const startPoint = vertices[currentVertexID]
        const endPoint = vertices[otherVertexID]
        const dx = endPoint.x - startPoint.x
        const dy = endPoint.y - startPoint.y
        return { angle: Math.atan2(dy, dx), edgeID, otherVertexID }
      })
      .sort((a, b) => a.angle - b.angle)
    const m = anglesAndEdgeIDs.length
    const indexOfCurrent = anglesAndEdgeIDs.findIndex(({ edgeID }) => {
      const edge = edges[edgeID]
      return edge.start === prevVertexID || edge.end === prevVertexID
    })
    nextVertexID = anglesAndEdgeIDs[(indexOfCurrent + m - 1) % m].otherVertexID
    if (nextVertexID === vertexTwoId && currentVertexID === vertexOneID) break
    loop.push(nextVertexID)
    prevVertexID = currentVertexID
    currentVertexID = nextVertexID
  }
  return loop
}
