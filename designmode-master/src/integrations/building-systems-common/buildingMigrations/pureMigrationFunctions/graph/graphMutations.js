import { v4 as uuidv4 } from "uuid"

function getUnitAndNormalVectorsOfLine(line) {
  const [pOne, pTwo] = line
  const length = getDistBetweenPoints(...line)
  const dx = (pTwo.x - pOne.x) / length
  const dy = (pTwo.y - pOne.y) / length
  return { unit: [dx, dy], normal: [-dy, dx] }
}
function coordinateTransformPoints(points, origin, direction) {
  const { unit, normal } = getUnitAndNormalVectorsOfLine(direction)
  return points.map((point) => {
    const x = (point.x - origin.x) * unit[0] + (point.y - origin.y) * unit[1]
    const y = (point.x - origin.x) * normal[0] + (point.y - origin.y) * normal[1]
    return { x, y }
  })
}
function getDistBetweenPoints(pointOne, pointTwo) {
  return ((pointTwo.x - pointOne.x) ** 2 + (pointTwo.y - pointOne.y) ** 2) ** 0.5
}
function isPointOnLine(point, line, buffer) {
  const origin = line[0]
  const [{ x: s, y: t }] = coordinateTransformPoints([point], origin, line)
  const lineLength = getDistBetweenPoints(...line)
  return s >= buffer && s <= lineLength - buffer && Math.abs(t) < buffer
}

/////
function getVertexEdgeMap(graph) {
  const vertexEdgeMap = {}
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

export function _addCloseVerticesToEdges(graph) {
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
      const newEdgeID = uuidv4()
      edges[newEdgeID] = { id: newEdgeID, start: edge.start, end: vertex.id }
      edge.start = vertex.id
    })
  }
}
export function _removeDuplicatedEdges(graph) {
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

export function _removeUnusedVertices(graph) {
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const { vertices } = graph
  Object.keys(vertexEdgeMap).forEach((vertexID) => {
    if (vertexEdgeMap[vertexID].length === 0) delete vertices[vertexID]
  })
}
export function _removeDuplicatedVertices(graph) {
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

function _mutSnapVertices(vertices, distance = 5e-3) {
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

export function _snapCloseVertices(graph) {
  const { vertices } = graph

  _mutSnapVertices(vertices)
  _removeDuplicatedVertices(graph)
  _removeDuplicatedEdges(graph)
}

export function _removeZeroEdges(graph) {
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
export function _cleanGraph(graph) {
  _snapCloseVertices(graph)
  _removeDuplicatedVertices(graph)
  _removeDuplicatedEdges(graph)
  _removeZeroEdges(graph)
  _removeUnusedVertices(graph)

  _addCloseVerticesToEdges(graph)
  _removeDuplicatedEdges(graph)
  _removeUnusedVertices(graph)
}
