import { _removeUnusedVertices } from "./utils/graphUtils" // eslint-disable-line import/no-internal-modules

const deepCopy = (data) => JSON.parse(JSON.stringify(data))

export const removeVertex = (_wallGraph, vertexID) => {
  const wallGraph = deepCopy(_wallGraph)

  const { edges, vertices } = wallGraph

  Object.keys(edges).forEach((edgeID) => {
    const { start, end } = edges[edgeID]
    if (start === vertexID || end === vertexID) delete edges[edgeID]
  })

  delete vertices[vertexID]

  return wallGraph
}

export const removeEdges = (_wallGraph, edgeIDs) => {
  const wallGraph = deepCopy(_wallGraph)

  const { edges } = wallGraph

  for (let edgeID of edgeIDs) {
    delete edges[edgeID]
  }
  _removeUnusedVertices(wallGraph)

  return wallGraph
}
