import type { Edge, Graph, Id, InternalVertex, PType } from "./types"
import graphInternal from "./graph-internal"
import type { Vector } from "./utils/math"
import math from "./utils/math"
import Array, { isDefined } from "src/lib/array"
import { newId } from "src/lib/element/urn"
import { objectKeys } from "src/lib/record"

function empty<EdgeProperties extends PType = any, CoEdgeProperties extends PType = any>(): Graph<
  EdgeProperties,
  CoEdgeProperties
> {
  const id = newId()
  return {
    id,
    vertices: {},
    edges: {},

    _edges: {},
    _vertices: {},
    _coEdges: {},

    _loops: {},
    _polygons: {},

    _counter: 0,
  }
}

function addVertex<T extends PType, U extends PType>(
  graph: Graph<T, U>,
  x: number,
  y: number,
  props?: any,
): [Graph<T, U>, Id] {
  const [g0, vertexId] = graphInternal._addVertex(graph, x, y, props)
  const g1 = graphInternal._updateInternals(g0, [])
  return [g1, vertexId]
}

function addEdge<T extends PType, U extends PType>(
  graph: Graph<T, U>,
  start: Id,
  end: Id,
  properties?: T,
  _edgeId?: Id,
): [Graph<T, U>, Id] {
  const [g0, edgeId] = graphInternal._addEdge(graph, start, end, properties, _edgeId)
  const g1 = graphInternal._updateInternals(g0, [edgeId])

  return [g1, edgeId]
}

function setPropertiesOnEdge<T extends PType, U extends PType>(
  graph: Graph<T, U>,
  internalEdgeId: Id,
  properties: T,
): Graph<T, U> {
  return {
    ...graph,
    _edges: Object.fromEntries(
      Object.entries(graph._edges).map(([id, edge]) => [id, id === internalEdgeId ? { ...edge, properties } : edge]),
    ),
  }
}

function setPropertiesOnVertex<T extends PType, U extends PType, V extends PType, W extends PType>(
  graph: Graph<T, U, V, W>,
  vertexId: Id,
  properties: W,
): Graph<T, U, V, W> {
  return {
    ...graph,
    vertices: Object.fromEntries(
      Object.entries(graph.vertices).map(([id, vertex]) => [id, id === vertexId ? { ...vertex, properties } : vertex]),
    ),
  }
}

function setPropertiesOnPolygon<T extends PType>(graph: Graph<T>, polygonId: Id, properties: T): Graph<T> {
  return {
    ...graph,
    _polygons: Object.fromEntries(
      Object.entries(graph._polygons).map(([id, polygon]) => [
        id,
        id === polygonId ? { ...polygon, properties } : polygon,
      ]),
    ),
  }
}

function setPropertiesOnCoEdge<T extends PType>(graph: Graph<any, T>, coEdgeId: Id, properties: T): Graph<any, T> {
  return {
    ...graph,
    _coEdges: Object.fromEntries(
      Object.entries(graph._coEdges).map(([id, coEdge]) => [id, id === coEdgeId ? { ...coEdge, properties } : coEdge]),
    ),
  }
}

// TODO: Return id of other vertex if it snaps
function moveVertex(graph: Graph, vertexId: string, x: number, y: number): [Graph, Record<Id, Id>] {
  const g0 = graphInternal._moveVertex(graph, vertexId, x, y)

  const touchedEdges = objectKeys(graph.edges).filter(
    (eid) => graph.edges[eid].start === vertexId || graph.edges[eid].end === vertexId,
  )

  const g1 = graphInternal._updateInternals(g0, touchedEdges)

  // Detect new coedges that weren't present in the input graph
  const newCoEdgeIds = objectKeys(g1._coEdges).filter((coEdgeId) => graph._coEdges[coEdgeId] === undefined)

  // For each new coedge, look for original coedge in old graph to copy properties/house types from
  const newToOldCoEdgeMap: Record<Id, Id> = {}
  for (const newCoEdgeId of newCoEdgeIds) {
    // This follows the property-copying logic in createCoEdges in graph-internal.ts
    const coEdge = g1._coEdges[newCoEdgeId]
    const edgeForCoEdge = g1._edges[coEdge.edgeId]
    const adjacentCoEdgeId = objectKeys(graph._coEdges).find((otherCoEdgeId) => {
      const otherCoEdge = graph._coEdges[otherCoEdgeId]
      const edgeForOtherCoEdge = graph._edges[otherCoEdge.edgeId]

      const isSameSuperEdge = edgeForOtherCoEdge.superEdgeId === edgeForCoEdge.superEdgeId
      const isSameDirection = otherCoEdge.reverse === coEdge.reverse
      const hasSharedPoint =
        edgeForOtherCoEdge.start === edgeForCoEdge.start || edgeForOtherCoEdge.end === edgeForCoEdge.end

      return isSameSuperEdge && isSameDirection && hasSharedPoint
    })
    if (adjacentCoEdgeId) {
      newToOldCoEdgeMap[newCoEdgeId] = adjacentCoEdgeId
    }
  }
  // Return new graph along with a map of new to old coEdgeIds for copying properties/house types
  return [g1, newToOldCoEdgeMap]
}

export function makeNewIntersectionsHaveSameIdsAsBeforeSplit(
  g4: Graph<any, any, any, any>,
  newEdgeId1: string,
  newEdgeId2: string,
  previousVertices: Record<Id, InternalVertex>,
  superEdgeBeforeSplitId: string,
) {
  const afterSplitToBeforeSplitIntersectionId: Record<Id, Id> = {}
  const internalVertices = Object.fromEntries(
    Object.entries(g4._vertices).map(([id, vertex]) => {
      if (vertex.type !== "intersection") {
        return [id, vertex]
      }
      const intersectedWithNewEdgeId =
        vertex.intersection.a.id === newEdgeId1
          ? newEdgeId1
          : vertex.intersection.a.id === newEdgeId2
            ? newEdgeId2
            : vertex.intersection.b.id === newEdgeId1
              ? newEdgeId1
              : vertex.intersection.b.id === newEdgeId2
                ? newEdgeId2
                : undefined
      if (!intersectedWithNewEdgeId) {
        return [id, vertex]
      }
      const otherEdgeId =
        vertex.intersection.a.id === intersectedWithNewEdgeId ? vertex.intersection.b.id : vertex.intersection.a.id
      const intersectionVertexBeforeSplit = Object.entries(previousVertices).find(
        ([, v]) =>
          v.type === "intersection" &&
          (v.intersection.a.id === otherEdgeId || v.intersection.a.id === superEdgeBeforeSplitId) &&
          (v.intersection.b.id === otherEdgeId || v.intersection.b.id === superEdgeBeforeSplitId),
      )
      if (!intersectionVertexBeforeSplit) {
        throw new Error("wtf")
      }
      afterSplitToBeforeSplitIntersectionId[id] = intersectionVertexBeforeSplit[0]
      return [intersectionVertexBeforeSplit[0], vertex]
    }),
  )

  const newInternalEdges = Object.fromEntries(
    Object.entries(g4._edges).map(([id, edge]) => {
      const start = afterSplitToBeforeSplitIntersectionId[edge.start] || edge.start
      const end = afterSplitToBeforeSplitIntersectionId[edge.end] || edge.end
      return [
        id,
        {
          ...edge,
          start,
          end,
        },
      ]
    }),
  )

  const g5: Graph = {
    ...g4,
    _vertices: internalVertices,
    _edges: newInternalEdges,
  }
  return g5
}

function removeVertex(graph: Graph, vertexId: Id): [Graph, string[]] {
  const g0 = graphInternal._removeVertex(graph, vertexId)
  const edgeIdsConnectedToVertex = Object.entries(g0.edges)
    .filter(([, edge]) => edge.start === vertexId || edge.end === vertexId)
    .map(([id]) => id)
  if (edgeIdsConnectedToVertex.length == 1) {
    const edgeIdConnectedToVertex = edgeIdsConnectedToVertex[0]
    const g1 = graphInternal._removeEdge(g0, edgeIdConnectedToVertex)
    const otherVertexOfEdge =
      graph.edges[edgeIdConnectedToVertex].start === vertexId
        ? graph.edges[edgeIdConnectedToVertex].end
        : graph.edges[edgeIdConnectedToVertex].start
    const g2 = graphInternal._isOrphan(g1, otherVertexOfEdge) ? graphInternal._removeVertex(g1, otherVertexOfEdge) : g1

    //TODO check if this is corrected touched edges
    return [graphInternal._updateInternals(g2, []), [edgeIdConnectedToVertex]]
  }
  if (edgeIdsConnectedToVertex.length >= 2) {
    /** When a vertex we wish to remove has several edges connected to it,
     *  we pick one neighbouring vertex and 'merge' the vertex with that neighbour.
     */
    const shortestSuperEdge = edgeIdsConnectedToVertex.reduce(
      (shortestEdge, edgeId) => {
        const edge = graph.edges[edgeId]
        const length = math.edgeLength(graph.vertices[edge.start], graph.vertices[edge.end])
        return length < shortestEdge.length ? { edgeId, length } : shortestEdge
      },
      { edgeId: "", length: Number.MAX_SAFE_INTEGER },
    )
    const vertexToMergeVertexIdWith =
      graph.edges[shortestSuperEdge.edgeId].start === vertexId
        ? graph.edges[shortestSuperEdge.edgeId].end
        : graph.edges[shortestSuperEdge.edgeId].start
    const [g1, edgesConnectedToReplacedVertex] = replaceVertex(g0, vertexId, vertexToMergeVertexIdWith)
    const g2 = graphInternal._removeVertex(g1, vertexId)
    const g3 = graphInternal._removeEdge(g2, shortestSuperEdge.edgeId)
    const g4 = graphInternal._updateInternals(g3, [...edgesConnectedToReplacedVertex])
    return [g4, edgesConnectedToReplacedVertex]
  }
  return [g0, []]
}

function replaceVertex(graph: Graph, vertexIdToReplace: string, vertexIdToReplaceWith: string): [Graph, Id[]] {
  const superEdges: Record<Id, Edge> = {}
  const edgesConnectedToReplacedVertex: Id[] = []
  for (let [edgeId, edge] of Object.entries(graph.edges)) {
    const start = edge.start === vertexIdToReplace ? vertexIdToReplaceWith : edge.start
    const end = edge.end === vertexIdToReplace ? vertexIdToReplaceWith : edge.end
    if (start !== edge.start || end !== edge.end) {
      edgesConnectedToReplacedVertex.push(edgeId)
    }
    superEdges[edgeId] = { start, end }
  }
  return [{ ...graph, edges: superEdges }, edgesConnectedToReplacedVertex]
}

// TODO: Use edgeId
function splitEdge(graph: Graph, internalEdgeId: string, newPoint: Vector): [Graph, Id[], Record<Id, Id>] {
  const edgeId = graph._edges[internalEdgeId].superEdgeId
  const g0 = graphInternal._removeEdge(graph, edgeId)
  const [g1, newVertexId] = graphInternal._addVertex(g0, newPoint.x, newPoint.y)
  const edgeBeforeSplit = graph.edges[edgeId]
  const [g2, newEdgeId1] = graphInternal._addEdge(g1, edgeBeforeSplit.start, newVertexId, edgeBeforeSplit.properties)
  const [g3, newEdgeId2] = graphInternal._addEdge(g2, newVertexId, edgeBeforeSplit.end, edgeBeforeSplit.properties)
  const g4 = graphInternal._updateInternals(g3, [edgeId, newEdgeId1, newEdgeId2])

  const g5 = makeNewIntersectionsHaveSameIdsAsBeforeSplit(g4, newEdgeId1, newEdgeId2, graph._vertices, edgeId)

  const internalEdgesForSplitEdgeBeforeSplit = Object.values(graph._edges).filter((edge) => edge.superEdgeId === edgeId)
  // Make sure that the new internal edges have the same properties as the edge before the split
  const internalEdges = Object.fromEntries(
    Object.entries(g5._edges).map(([id, edge]) => {
      if (edge.superEdgeId !== newEdgeId1 && edge.superEdgeId !== newEdgeId2) return [id, edge]
      const correspondingEdgeBeforeSplit = internalEdgesForSplitEdgeBeforeSplit.find(
        (e) => e.start === edge.start || e.end === edge.end,
      )
      if (!correspondingEdgeBeforeSplit) {
        throw new Error("Didn't find the expected corresponding coEdge from before the split")
      }
      return [
        id,
        {
          ...edge,
          properties: correspondingEdgeBeforeSplit.properties,
        },
      ]
    }),
  )
  const coEdgesForSplitEdgeBeforeSplit = Object.entries(graph._coEdges)
    .map(([id, coEdge]) => {
      if (graph._edges[coEdge.edgeId].superEdgeId === edgeId) {
        return { ...coEdge, id }
      }
    })
    .filter(isDefined)
  // Make sure that the new coEdges have the same properties as the coEdge before the split
  const copyChildrenMap: Record<Id, Id> = {}
  const coEdges = Object.fromEntries(
    Object.entries(g5._coEdges).map(([id, coEdge]) => {
      if (g5._edges[coEdge.edgeId].superEdgeId !== newEdgeId1 && g5._edges[coEdge.edgeId].superEdgeId !== newEdgeId2) {
        return [id, coEdge]
      }
      const correspondingCoEdgeBeforeSplit = coEdgesForSplitEdgeBeforeSplit.find(
        (e) =>
          (graph._edges[e.edgeId].start === g5._edges[coEdge.edgeId].start ||
            graph._edges[e.edgeId].end === g5._edges[coEdge.edgeId].end) &&
          e.reverse === coEdge.reverse,
      )

      if (!correspondingCoEdgeBeforeSplit) {
        throw new Error("Didn't find the expected corresponding coEdge from before the split")
      }
      copyChildrenMap[id] = correspondingCoEdgeBeforeSplit.id
      return [id, { ...coEdge, properties: correspondingCoEdgeBeforeSplit.properties }]
    }),
  )

  const newGraphWithProps = {
    ...g5,
    _edges: internalEdges,
    _coEdges: coEdges,
  }
  return [newGraphWithProps, [newEdgeId1, newEdgeId2], copyChildrenMap]
}

// Optimized version of adding multiple linestrings/polygons to the graph
function addFromPointArrays(graph: Graph, lines: Vector[][]): [Graph, { vertexIds: Id[]; edgeIds: Id[] }[]] {
  let g = graph
  const mappings: { vertexIds: Id[]; edgeIds: Id[] }[] = []

  for (let line of lines) {
    const [g0, vertexIds] = graphInternal._addVertices(g, line, true)

    let filteredVertexIdsWithoutDuplicates: Id[] = []
    for (let vertexId of vertexIds) {
      if (vertexId === filteredVertexIdsWithoutDuplicates[filteredVertexIdsWithoutDuplicates.length - 1]) continue
      filteredVertexIdsWithoutDuplicates.push(vertexId)
    }

    const edgesToAdd = Array.sliding2(filteredVertexIdsWithoutDuplicates).map(([v0, v1]) => ({ start: v0, end: v1 }))

    const [g1, edgeIds] = graphInternal._addEdges(g0, edgesToAdd)

    g = g1
    mappings.push({ vertexIds, edgeIds })
  }

  return [
    graphInternal._updateInternals(
      g,
      mappings.flatMap((m) => m.edgeIds),
    ),
    mappings,
  ]
}

export default {
  empty,
  addVertex,
  removeVertex,
  addEdge,
  splitEdge,
  moveVertex,
  replaceVertex,
  setPropertiesOnEdge,
  setPropertiesOnVertex,
  setPropertiesOnCoEdge,
  setPropertiesOnPolygon,

  helpers: {
    addFromPointArrays,
  },
}
