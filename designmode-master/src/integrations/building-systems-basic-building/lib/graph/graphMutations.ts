import type { Graph, Vertices } from "./graph"
import { getVertexEdgeMap } from "./graph"
import { isPointOnLine } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"

export function _removeDuplicatedEdges(graph: Graph) {
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
export function _removeDuplicatedVertices(graph: Graph) {
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

function _mutSnapVertices(vertices: Vertices, distance = 5e-3) {
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

export function _snapCloseVertices(graph: Graph) {
  const { vertices } = graph

  _mutSnapVertices(vertices)
  _removeDuplicatedVertices(graph)
  _removeDuplicatedEdges(graph)
}

export function _removeUnusedVertices(graph: Graph) {
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const { vertices } = graph
  Object.keys(vertexEdgeMap).forEach((vertexID) => {
    if (vertexEdgeMap[vertexID].length === 0) delete vertices[vertexID]
  })
}

export function _addCloseVerticesToEdges(graph: Graph) {
  const { edges, vertices } = graph
  const listOfVertices = Object.values(vertices)
  const listOfEdges = Object.values(edges)
  for (let edge of listOfEdges) {
    const startVertex = vertices[edge.start]
    const endVertex = vertices[edge.end]

    const sortedVerticesOnLine = listOfVertices
      .filter((vertex) => {
        if (vertex.id === startVertex.id || vertex.id === endVertex.id) return false
        const buffer = 5e-3
        return isPointOnLine(vertex, [startVertex, endVertex], buffer)
      })
      .map((vertex) => {
        const dist = ((vertex.x - startVertex.x) ** 2 + (vertex.y - startVertex.y) ** 2) ** 0.5
        return { dist, vertex }
      })
      .sort((a, b) => {
        return a.dist - b.dist
      })
    sortedVerticesOnLine.forEach(({ vertex }) => {
      const newEdgeID = randomId()
      edges[newEdgeID] = { id: newEdgeID, start: edge.start, end: vertex.id }
      edge.start = vertex.id
    })
  }
}
