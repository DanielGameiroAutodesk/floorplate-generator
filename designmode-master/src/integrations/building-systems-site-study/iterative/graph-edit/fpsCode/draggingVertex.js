import { v4 as uuidv4 } from "uuid"

import { snapPointToWallsOrGrid } from "./snapping"
import { findCrossingPointOfLines, getLineLength } from "./utils/geoUtils" // eslint-disable-line import/no-internal-modules
import { _addCloseVertexPointsToLine } from "./addingLinesToGraph"
import { getVertexEdgeMap, _removeDuplicatedEdges, _removeUnusedVertices } from "./utils/graphUtils" // eslint-disable-line import/no-internal-modules
import { getDraggingVertexGuideLines } from "./draggingVertexGuideLines"

const deepCopy = (data) => JSON.parse(JSON.stringify(data))

export const findCrossingPoints = (graph, vertexIDs) => {
  const { edges, vertices } = graph
  const vertexIdSet = new Set(vertexIDs)
  const movingEdges = Object.values(edges).filter((edge) => vertexIdSet.has(edge.start) || vertexIdSet.has(edge.end))
  const staticEdges = Object.values(edges).filter((edge) => !vertexIdSet.has(edge.start) && !vertexIdSet.has(edge.end))
  const crossingPoints = []
  const n = staticEdges.length
  const m = movingEdges.length
  for (let i = 0; i < n; i++) {
    const edgeOne = staticEdges[i]
    const lineOne = [vertices[edgeOne.start], vertices[edgeOne.end]]
    for (let j = 0; j < m; j++) {
      const edgeTwo = movingEdges[j]
      const lineTwo = [vertices[edgeTwo.start], vertices[edgeTwo.end]]
      if (
        edgeOne.start === edgeTwo.start ||
        edgeOne.end === edgeTwo.end ||
        edgeOne.start === edgeTwo.end ||
        edgeOne.end === edgeTwo.start
      )
        continue
      const buffer = 1e-3
      const crossingPoint = findCrossingPointOfLines(lineOne, lineTwo, buffer)
      if (crossingPoint) crossingPoints.push(crossingPoint)
    }
  }
  return crossingPoints
}

export const _addCloseVerticesToEdges = (graph) => {
  const { edges, vertices } = graph
  const edgeIDs = Object.keys(edges)
  edgeIDs.forEach((edgeID) => {
    const edge = edges[edgeID]
    const vertexOne = vertices[edge.start]
    const vertexTwo = vertices[edge.end]
    const lineLength = getLineLength([vertexOne, vertexTwo])
    if (lineLength > 1e-3) _addCloseVertexPointsToLine(graph, edgeID)
  })
}

const _removeVertexIfDroppedOnOther = (graph, vertexID) => {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const vertexIDs = Object.keys(vertices)
  const n = vertexIDs.length
  for (let i = 0; i < n; i++) {
    const vertexTwoID = vertexIDs[i]
    if (vertexTwoID === vertexID) continue
    const vertexOne = vertices[vertexID]
    const vertexTwo = vertices[vertexTwoID]
    if (vertexOne.x !== vertexTwo.x || vertexOne.y !== vertexTwo.y) continue
    delete vertices[vertexID]
    const edgeIDs = vertexEdgeMap[vertexID]
    edgeIDs.forEach((edgeID) => {
      const edge = edges[edgeID]
      if (edge.start === vertexID) edge.start = vertexTwoID
      if (edge.end === vertexID) edge.end = vertexTwoID
      if (edge.start === edge.end) delete edges[edgeID]
    })
    break
  }
}

const moveVertexInGraph = (_graph, vertexID, newVertexPosition) => {
  const graph = deepCopy(_graph)
  const { vertices } = graph

  const vertex = graph.vertices[vertexID]
  vertex.x = newVertexPosition.x
  vertex.y = newVertexPosition.y

  const crossingPoints = findCrossingPoints(graph, [vertexID])

  crossingPoints.forEach((point) => {
    const vertexID = uuidv4()
    vertices[vertexID] = { id: vertexID, x: point.x, y: point.y }
  })
  _addCloseVerticesToEdges(graph)
  _removeDuplicatedEdges(graph)
  _removeVertexIfDroppedOnOther(graph, vertexID)
  _removeDuplicatedEdges(graph)
  _removeUnusedVertices(graph)

  return graph
}

const getSnappingLines = (graph, vertexID) => {
  const { vertices, edges } = graph
  const lines = []
  for (let edge of Object.values(edges)) {
    if (edge.start === vertexID || edge.end === vertexID) continue
    const line = [vertices[edge.start], vertices[edge.end]]
    lines.push(line)
  }
  return lines
}

const getNewVertexPosition = (graph, vertexID, mouseDownPosition, mousePosition) => {
  const vertex = graph.vertices[vertexID]

  let dx = mousePosition.x - mouseDownPosition.x
  let dy = mousePosition.y - mouseDownPosition.y

  const x = vertex.x + dx
  const y = vertex.y + dy
  return { x, y }
}

export const dragVertex = (_wallGraph, vertexID, mouseDownPosition, mousePosition, snappingDist, snappingRules) => {
  const wallLines = getSnappingLines(_wallGraph, vertexID)
  const guidelines = getDraggingVertexGuideLines(_wallGraph, vertexID, snappingRules)
  const newVertexPosition = getNewVertexPosition(_wallGraph, vertexID, mouseDownPosition, mousePosition)

  const snappedVertex = snapPointToWallsOrGrid({
    point: newVertexPosition,
    walls: wallLines,
    snappingDist,
    snappingRules,
    guidelines,
  })
  const snappedVertexPosition = snappedVertex.point
  const wallGraph = moveVertexInGraph(_wallGraph, vertexID, snappedVertexPosition)
  return { wallGraph, snappingData: snappedVertex }
}
