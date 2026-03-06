import { v4 as uuidv4 } from "uuid"

import { addLineToGraph } from "./addingLinesToGraph"
import { _snapCloseVertices } from "./utils/graphUtils" // eslint-disable-line import/no-internal-modules

const deepCopy = (data) => JSON.parse(JSON.stringify(data))

const addNewEdge = (_wallGraph, startPointSpace, endPointSpace) => {
  const wall = [startPointSpace, endPointSpace]
  const wallGraph = addLineToGraph(_wallGraph, wall)
  return wallGraph
}

const addPointToExistingEdge = (_wallGraph, snappedPoint) => {
  const wallGraph = deepCopy(_wallGraph)
  const { point, wall } = snappedPoint
  const { edges, vertices } = wallGraph

  const edge = Object.values(edges).find(
    (edge) =>
      (edge.start === wall[0].id && edge.end === wall[1].id) || (edge.end === wall[0].id && edge.start === wall[1].id),
  )

  const newVertexID = uuidv4()
  vertices[newVertexID] = { id: newVertexID, x: point.x, y: point.y }
  const newEdgeID = uuidv4()
  edges[newEdgeID] = { id: newEdgeID, start: newVertexID, end: edge.end }
  edge.end = newVertexID

  _snapCloseVertices(wallGraph)
  return wallGraph
}

const addNewPoint = (_wallGraph, point) => {
  const wallGraph = deepCopy(_wallGraph)
  const newVertexID = uuidv4()
  wallGraph.vertices[newVertexID] = { id: newVertexID, x: point.x, y: point.y }
  return wallGraph
}

export { addNewEdge, addNewPoint, addPointToExistingEdge }
