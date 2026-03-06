import { objectKeys } from "src/lib/record"
import type { Graph, Id } from "./types"
import type { Vector } from "./utils/math"
import math from "./utils/math"

export function _getCoEdgeVertices(graph: Pick<Graph, "_coEdges" | "_edges">, coEdgeId: Id): { start: Id; end: Id } {
  const coEdge = graph._coEdges[coEdgeId]
  const edge = graph._edges[coEdge.edgeId]

  return coEdge.reverse
    ? {
        start: edge.end,
        end: edge.start,
      }
    : {
        start: edge.start,
        end: edge.end,
      }
}

export function _getCoEdgeVector(graph: Graph, coEdgeId: Id): Vector {
  const { start, end } = _getCoEdgeVertices(graph, coEdgeId)
  const vertexStart = graph._vertices[start]
  const vertexEnd = graph._vertices[end]
  return math.getVector(vertexStart, vertexEnd)
}

export function _getCoEdgeLength(graph: Graph, coEdgeId: Id): number {
  const vector = _getCoEdgeVector(graph, coEdgeId)
  return Math.sqrt(vector.x ** 2 + vector.y ** 2)
}

export function _getCoEdgeDirection(graph: Graph, coEdgeId: Id): number {
  const vector = _getCoEdgeVector(graph, coEdgeId)
  return Math.atan2(vector.y, vector.x)
}

export function _findCoEdgesLeavingVertexId(graph: Pick<Graph, "_coEdges" | "_edges">, vertexId: Id): Id[] {
  let coEdges: Id[] = []

  for (let coEdgeId of objectKeys(graph._coEdges)) {
    const { start } = _getCoEdgeVertices(graph, coEdgeId)
    if (start === vertexId) {
      coEdges.push(coEdgeId)
    }
  }
  return coEdges
}

export function _getCoordinatesForPolygon(graph: Graph, polygonId: Id): Vector[] {
  const polygon = graph._polygons[polygonId]
  const loop = graph._loops[polygon.loopIds[0]]

  return loop.coEdgeIds.map((coEdgeId): Vector => {
    const nextVertexId = _getCoEdgeVertices(graph, coEdgeId).end
    const vertex = graph._vertices[nextVertexId]
    return {
      x: vertex.x,
      y: vertex.y,
    }
  })
}
