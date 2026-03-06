import { addVectorToPoint, getDistBetweenPoints, getUnitNormalVectorXY, getUnitVectorXY } from "./utils/geoUtils" // eslint-disable-line import/no-internal-modules

function getVertex(vertices, startPointSpace) {
  const vertexList = Object.values(vertices)
  for (let i = 0; i < vertexList.length; i++) {
    const vertex = vertexList[i]
    const dist = getDistBetweenPoints(startPointSpace, vertex)
    if (dist < 1e-8) {
      return vertex
    }
  }
  return undefined
}

function getNeighbourEdges(edges, vertex) {
  const edgeList = Object.values(edges)
  const neighbourEdges = []
  for (let edge of edgeList) {
    if (edge.start === vertex.id || edge.end === vertex.id) {
      neighbourEdges.push(edge)
    }
  }
  return neighbourEdges
}

const HALF_LENGTH = 500

function getAngle90GuideLines(edges, vertices, vertex, neighbourEdges) {
  return neighbourEdges.map((edge) => {
    const v0 = vertices[edge.start]
    const v1 = vertices[edge.end]
    const normal = getUnitNormalVectorXY(v0, v1)

    const p0 = addVectorToPoint(vertex, normal, -HALF_LENGTH)
    const p1 = addVectorToPoint(vertex, normal, HALF_LENGTH)

    return { line: [p0, p1], vertex, edge, type: "Angle90_Start" }
  })
}

function getAngle180GuideLines(edges, vertices, vertex, neighbourEdges) {
  return neighbourEdges.map((edge) => {
    const v0 = vertices[edge.start]
    const v1 = vertices[edge.end]
    const unitVec = getUnitVectorXY(v0, v1)

    const p0 = addVectorToPoint(vertex, unitVec, -HALF_LENGTH)
    const p1 = addVectorToPoint(vertex, unitVec, HALF_LENGTH)

    return { line: [p0, p1], vertex, edge, type: "Angle180_Start" }
  })
}

export function getDrawLineGuidelines({ startPointSpace, wallGraph, snappingRules }) {
  if (!startPointSpace) return []
  if (!snappingRules.guidelines) return []

  const { edges, vertices } = wallGraph

  const vertex = getVertex(vertices, startPointSpace)
  if (!vertex) return []
  const neighbourEdges = getNeighbourEdges(edges, vertex)

  const angle90Lines = getAngle90GuideLines(edges, vertices, vertex, neighbourEdges)
  const angle180Lines = getAngle180GuideLines(edges, vertices, vertex, neighbourEdges)

  return [...angle90Lines, ...angle180Lines]
}
