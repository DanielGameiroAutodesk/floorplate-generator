import type { Graph, Id } from "./types"
import math from "./utils/math"
import { _findCoEdgesLeavingVertexId, _getCoEdgeVertices } from "./coEdge"
import { objectKeys } from "src/lib/record"

// Find loops for the newCoEdgeIds only
function findLoopsBasedOnCoEdges(
  graph: Pick<Graph, "_coEdges" | "_vertices" | "_edges">,
  alreadyProcessedCoEdgeIds?: Id[],
): Id[][] {
  let visitedCoEdges = new Set<Id>(alreadyProcessedCoEdgeIds ?? [])

  const loops: Id[][] = []

  const precalculatedVertexIdToCoEdgeMap: Record<Id, Id[]> = {}

  for (let coEdgeId of objectKeys(graph._coEdges)) {
    const start = _getCoEdgeVertices(graph, coEdgeId).start
    if (!(start in precalculatedVertexIdToCoEdgeMap)) {
      precalculatedVertexIdToCoEdgeMap[start] = []
    }
    precalculatedVertexIdToCoEdgeMap[start].push(coEdgeId)
  }

  for (let coEdgeId of objectKeys(graph._coEdges)) {
    if (visitedCoEdges.has(coEdgeId)) continue

    const result = _traverseCoEdge(graph, coEdgeId, precalculatedVertexIdToCoEdgeMap)

    result.forEach((co) => visitedCoEdges.add(co))
    loops.push(result)
  }

  return loops
}

function _traverseCoEdge(
  graph: Pick<Graph, "_coEdges" | "_vertices" | "_edges">,
  coEdgeId: Id,
  precalculatedVertexIdToCoEdgeMap: Record<Id, Id[]>,
): Id[] {
  const coEdgeIds: Id[] = [coEdgeId]
  let nextCoEdgeId = _nextCoEdge(graph, coEdgeId, precalculatedVertexIdToCoEdgeMap)
  let currentEdge = coEdgeId

  while (coEdgeId !== nextCoEdgeId) {
    if (coEdgeIds.includes(nextCoEdgeId)) {
      console.error("Traversing coedges circeled to non-start coedge", coEdgeIds, nextCoEdgeId)
      return coEdgeIds
    }

    coEdgeIds.push(nextCoEdgeId)
    currentEdge = nextCoEdgeId
    nextCoEdgeId = _nextCoEdge(graph, currentEdge, precalculatedVertexIdToCoEdgeMap)
  }

  return coEdgeIds
}

function getRightMostCoEdge(
  graph: Pick<Graph, "_coEdges" | "_vertices" | "_edges">,
  prevVertexId: string,
  currentVertexId: string,
  candidatesNotGoingBack: {
    coEdgeId: string
    vertexId: string
  }[],
) {
  const currentDirection = math.normalizeVector(
    math.getVector(graph._vertices[prevVertexId], graph._vertices[currentVertexId]),
  )

  const scores = candidatesNotGoingBack.map(({ vertexId }) => {
    const nextDirection = math.normalizeVector(
      math.getVector(graph._vertices[currentVertexId], graph._vertices[vertexId]),
    )
    return math.scoreDirection(currentDirection, nextDirection)
  })

  const minIndex = math.argMax(scores)

  return candidatesNotGoingBack[minIndex].coEdgeId
}

function _nextCoEdge(
  graph: Pick<Graph, "_coEdges" | "_edges" | "_vertices">,
  coEdgeId: Id,
  precalculatedVertexIdToCoEdgeMap: Record<Id, Id[]>,
): Id {
  const { start: prevVertexId, end: currentVertexId } = _getCoEdgeVertices(graph, coEdgeId)

  const candidates = precalculatedVertexIdToCoEdgeMap[currentVertexId].map((id) => ({
    vertexId: _getCoEdgeVertices(graph, id).end,
    coEdgeId: id,
  }))

  if (candidates.length === 0) {
    throw new Error(`Could not find next coEdges for coEdge ${coEdgeId}`)
  }

  if (candidates.length === 1) {
    return candidates[0].coEdgeId
  }
  return getRightMostCoEdge(
    graph,
    prevVertexId,
    currentVertexId,
    candidates.filter(({ vertexId }) => vertexId !== prevVertexId),
  )
}

export default {
  findLoopsBasedOnEdges: findLoopsBasedOnCoEdges,
  _findCoEdgesLeavingVertexId,
}
