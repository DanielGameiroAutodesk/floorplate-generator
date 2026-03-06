import { v4 as uuidv4 } from "uuid"

import { findCrossingPointOfLines, getDistBetweenPoints, getLineLength, isPointOnLine } from "./utils/geoUtils" // eslint-disable-line import/no-internal-modules
import { _removeDuplicatedEdges } from "./utils/graphUtils" // eslint-disable-line import/no-internal-modules

const deepCopy = (data) => {
  return JSON.parse(JSON.stringify(data))
}

export function _addCloseVertexPointsToLine(graph, edgeID) {
  const { vertices, edges } = graph
  const { start, end } = edges[edgeID]
  const pointsOnLine = []
  const startVertex = vertices[start]
  const endVertex = vertices[end]
  for (let vertex of Object.values(vertices)) {
    if (vertex.id === start || vertex.id === end) continue
    const buffer = 5e-3
    if (isPointOnLine(vertex, [startVertex, endVertex], buffer)) {
      pointsOnLine.push(vertex)
    }
  }
  const sortedVertexIDs = pointsOnLine
    .map((point) => {
      const distMetric =
        (point.x - startVertex.x) * (endVertex.x - startVertex.x) +
        (point.y - startVertex.y) * (endVertex.y - startVertex.y)
      return { dist: distMetric, vertexID: point.id }
    })
    .sort((vertexOne, vertexTwo) => vertexOne.dist - vertexTwo.dist)

  let startID = start
  for (let vertexIDAndDist of sortedVertexIDs) {
    const { vertexID } = vertexIDAndDist
    const newEdgeID = uuidv4()
    edges[newEdgeID] = { start: startID, end: vertexID, id: newEdgeID }
    edges[edgeID].start = vertexID
    startID = vertexID
  }
  return graph
}

function findCrossingPoints(graph, start, end, print) {
  const { vertices, edges } = graph
  const crossingPoints = []
  Object.values(edges).forEach((edge) => {
    if (edge.start !== start && edge.end !== end && edge.start !== end && edge.end !== start) {
      const lineOne = [vertices[edge.start], vertices[edge.end]]
      const lineTwo = [vertices[start], vertices[end]]
      const buffer = 1e-3
      const crossingPoint = findCrossingPointOfLines(lineOne, lineTwo, buffer, print)
      if (crossingPoint) crossingPoints.push(crossingPoint)
    }
  })
  return crossingPoints
}

function _addVertexToGraph(graph, vertexID, vertex) {
  const { edges, vertices } = graph
  Object.values(edges).forEach((edge) => {
    const edgeStart = vertices[edge.start]
    const edgeEnd = vertices[edge.end]
    const buffer = 1e-3
    if (isPointOnLine(vertex, [edgeStart, edgeEnd], buffer)) {
      const newEdgeID = uuidv4()
      edges[newEdgeID] = { start: vertexID, end: edge.end, id: newEdgeID }
      edge.end = vertexID
    }
  })
  vertices[vertexID] = vertex
}

function _addLineToGraph(graph, line) {
  const { edges, vertices } = graph
  const lineLength = getLineLength(line)
  if (lineLength < 1e-2) return graph
  const [startPoint, endPoint] = line
  let start, end
  Object.entries(vertices).forEach(([vertexID, vertex]) => {
    const equalStart = getDistBetweenPoints(vertex, startPoint) < 1e-8
    if (equalStart) start = vertexID
    const equalEnd = getDistBetweenPoints(vertex, endPoint) < 1e-8
    if (equalEnd) end = vertexID
  })

  if (start && end) {
    const duplicate = Object.values(edges).some(
      (edge) => (edge.start === start && edge.end === end) || (edge.start === end && edge.end === start),
    )
    if (duplicate) return graph
  }
  if (!start) {
    const vertexID = uuidv4()
    const vertex = { x: startPoint.x, y: startPoint.y, id: vertexID }
    _addVertexToGraph(graph, vertexID, vertex)
    start = vertexID
  }
  if (!end) {
    const vertexID = uuidv4()
    const vertex = { x: endPoint.x, y: endPoint.y, id: vertexID }
    _addVertexToGraph(graph, vertexID, vertex)

    end = vertexID
  }
  const edgeID = uuidv4()
  edges[edgeID] = { start, end, id: edgeID }
  const crossingPoints = findCrossingPoints(graph, start, end)
  crossingPoints.forEach((point) => {
    const vertexID = uuidv4()
    const vertex = { x: point.x, y: point.y, id: vertexID }
    _addVertexToGraph(graph, vertexID, vertex)
  })
  graph = _addCloseVertexPointsToLine(graph, edgeID)
  graph = _removeDuplicatedEdges(graph)
  return graph
}

export function addLineToGraph(oldGraph, line) {
  let graph = deepCopy(oldGraph)
  graph = _addLineToGraph(graph, line)
  return graph
}

export function addLinesToGraph(oldGraph, lines) {
  let graph = deepCopy(oldGraph)
  for (const line of lines) {
    graph = _addLineToGraph(graph, line)
  }
  return graph
}
