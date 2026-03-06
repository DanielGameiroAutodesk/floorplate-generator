import { addVectorToPoint, getUnitNormalVectorXY, getUnitVectorXY } from "./utils/geoUtils" // eslint-disable-line import/no-internal-modules

function getNeighbourVertices(edges, vertices, vertexID) {
  const neighbourVertices = []
  const edgeList = Object.values(edges)
  for (let edge of edgeList) {
    if (edge.start === vertexID) {
      neighbourVertices.push({
        connectingEdge: edge,
        neighbourVertexID: edge.end,
      })
    }
    if (edge.end === vertexID) {
      neighbourVertices.push({
        connectingEdge: edge,
        neighbourVertexID: edge.start,
      })
    }
  }
  return neighbourVertices
}

function getSecondNeighbourEdges(edges, vertices, vertexID, neighbourVertices) {
  const secondNeighbourEdges = []
  const edgeList = Object.values(edges)
  for (let neighbourVertex of neighbourVertices) {
    const { neighbourVertexID, connectingEdge } = neighbourVertex
    for (let edge of edgeList) {
      if (edge.id === connectingEdge.id) continue
      if (edge.start !== neighbourVertexID && edge.end !== neighbourVertexID) continue
      const secondNeighbourVertexID = edge.start === neighbourVertexID ? edge.end : edge.start
      secondNeighbourEdges.push({
        neighbourVertexID,
        secondNeighbourVertexID,
        edgeID: edge.id,
      })
    }
  }
  return secondNeighbourEdges
}

const HALF_LENGTH = 500

function getAngle180GuideLines(edges, vertices, vertexID, secondNeighbourEdges) {
  const guideLines = []

  for (let secondNeighbourEdge of secondNeighbourEdges) {
    const { neighbourVertexID, secondNeighbourVertexID } = secondNeighbourEdge
    const v0 = vertices[neighbourVertexID]
    const v1 = vertices[secondNeighbourVertexID]
    const unitVec = getUnitVectorXY(v0, v1)

    const p0 = addVectorToPoint(v0, unitVec, -HALF_LENGTH)
    const p1 = addVectorToPoint(v0, unitVec, HALF_LENGTH)

    guideLines.push({ line: [p0, p1], type: "Angle180_Start" })
  }

  return guideLines
}

function getAngle90GuideLines(edges, vertices, vertexID, secondNeighbourEdges) {
  const guideLines = []

  for (let secondNeighbourEdge of secondNeighbourEdges) {
    const { neighbourVertexID, secondNeighbourVertexID } = secondNeighbourEdge
    const v0 = vertices[neighbourVertexID]
    const v1 = vertices[secondNeighbourVertexID]
    const normal = getUnitNormalVectorXY(v0, v1)

    const p0 = addVectorToPoint(v0, normal, -HALF_LENGTH)
    const p1 = addVectorToPoint(v0, normal, HALF_LENGTH)

    guideLines.push({ line: [p0, p1], type: "Angle90_Start" })
  }

  return guideLines
}

export function getDraggingVertexGuideLines(wallGraph, vertexID, snappingRules) {
  if (!snappingRules.guidelines) return []

  const { edges, vertices } = wallGraph

  const neighbourVertices = getNeighbourVertices(edges, vertices, vertexID)
  const secondNeighbourEdges = getSecondNeighbourEdges(edges, vertices, vertexID, neighbourVertices)

  const angle90Lines = getAngle90GuideLines(edges, vertices, vertexID, secondNeighbourEdges)
  const angle180Lines = getAngle180GuideLines(edges, vertices, vertexID, secondNeighbourEdges)

  return [...angle90Lines, ...angle180Lines]
}
