import type {
  CoEdge,
  Edge,
  Graph,
  GraphPolygon,
  Id,
  InternalEdge,
  InternalVertex,
  InternalVertexIntersection,
  Loop,
  PType,
  Vertex,
} from "./types"
import type { Intersection } from "./utils/lineIntersection"
import { lineIntersect } from "./utils/lineIntersection"
import Array, { isDefined } from "src/lib/array"

import traversal from "./traversal"
import type { Vector } from "./utils/math"
import math from "./utils/math"
import { _getCoEdgeVertices } from "./coEdge"
import { objectKeys } from "src/lib/record"

function _newId(): Id {
  return Math.random().toString(16).slice(2)
}

const THRESHOLD = 1e-6

function distSq(x0: number, y0: number, v1: Vertex<any>): number {
  return (v1.x - x0) ** 2 + (v1.y - y0) ** 2
}

function _getExistingVertex(vertices: Graph["vertices"], x: number, y: number): Id | undefined {
  const same = Object.entries(vertices)
    .filter(([, v_other]) => distSq(x, y, v_other) < THRESHOLD)
    .map(([vertexId]) => vertexId)

  if (same.length > 0) {
    return same[0]
  }
  return undefined
}

function getExistingEdge(edges: Graph["edges"], start: Id, end: Id): Id | undefined {
  const same = Object.entries(edges)
    .filter(
      ([, e_other]) =>
        (e_other.start === start && e_other.end === end) || (e_other.start === end && e_other.end === start),
    )
    .map(([edgeId]) => edgeId)

  return same[0]
}

function _moveVertex(graph: Graph, vertexId: Id, x: number, y: number): Graph {
  return {
    ...graph,
    vertices: {
      ...graph.vertices,
      [vertexId]: {
        ...graph.vertices[vertexId],
        x,
        y,
      },
    },
  }
}

function _addVertex<G extends Graph>(graph: G, x: number, y: number, props?: any): [G, Id] {
  const existingVertexId = _getExistingVertex(graph.vertices, x, y)
  if (existingVertexId) return [graph, existingVertexId]

  const newVertexId = _newId()
  const newVertex: Vertex = { x, y, properties: props }

  const graphWithNewVertex: G = {
    ...graph,
    vertices: {
      ...graph.vertices,
      [newVertexId]: newVertex,
    },
  }
  return [graphWithNewVertex, newVertexId]
}

function _removeVertex(graph: Graph, vertexId: Id): Graph {
  return {
    ...graph,
    vertices: Object.fromEntries(Object.entries(graph.vertices).filter(([id]) => id !== vertexId)),
  }
}

function _isOrphan(g1: Graph, vertexId: string) {
  return Object.values(g1.edges).filter((e) => e.start === vertexId || e.end === vertexId).length === 0
}

function _addVertices(graph: Graph, positions: Vector[], locked?: boolean): [Graph, Id[]] {
  let newVertices: Graph["vertices"] = {}
  let vertexIds: Id[] = []

  for (let { x, y } of positions) {
    const existingVertexId = _getExistingVertex(graph.vertices, x, y) ?? _getExistingVertex(newVertices, x, y)

    if (existingVertexId) {
      vertexIds.push(existingVertexId)
    } else {
      const vertexId = _newId()
      newVertices[vertexId] = { x, y, locked }
      vertexIds.push(vertexId)
    }
  }

  return [{ ...graph, vertices: { ...graph.vertices, ...newVertices } }, vertexIds]
}

function _addEdge<T extends PType>(graph: Graph, start: Id, end: Id, properties?: T, _edgeId?: Id): [Graph, Id] {
  const newEdgeId = _edgeId ?? _newId()
  const newGraph: Graph = {
    ...graph,
    edges: {
      ...graph.edges,
      [newEdgeId]: {
        start,
        end,
        properties,
      },
    },
  }
  return [newGraph, newEdgeId]
}

function _removeEdge(graph: Graph, edgeId: Id): Graph {
  return {
    ...graph,
    edges: Object.fromEntries(Object.entries(graph.edges).filter(([id]) => id !== edgeId)),
  }
}

type EdgeLookupKey = `${Id}_${Id}` // `${start}_${end}`
class EdgeLookupMap<T extends Edge | InternalEdge> extends Map<EdgeLookupKey, Id> {
  constructor(edges?: Record<Id, T>) {
    super()
    if (edges) this.addEdges(edges)
  }

  addEdges(edges: Record<Id, T>) {
    for (let [edgeId, edge] of Object.entries(edges)) {
      this.addEdge(edgeId, edge)
    }
  }

  addEdge(edgeId: Id, edge: T) {
    this.set(`${edge.start}_${edge.end}`, edgeId)
  }
}

function _addEdges(graph: Graph, edges: { start: Id; end: Id }[]): [Graph, Id[]] {
  const edgeLookupMap = new EdgeLookupMap(graph.edges)

  const newEdges: Graph["edges"] = {}

  for (let { start, end } of edges) {
    const existingEdge = edgeLookupMap.get(`${start}_${end}`) ?? edgeLookupMap.get(`${end}_${start}`)
    if (existingEdge) {
      console.warn("did not add existing edge")
      continue
    }

    const id = _newId()
    const edge: Edge = { start, end }
    edgeLookupMap.addEdge(id, edge)
    newEdges[id] = edge
  }

  return [
    {
      ...graph,
      edges: {
        ...graph.edges,
        ...newEdges,
      },
    },
    objectKeys(newEdges),
  ]
}

type EdgeIntersection = { intersection: Intersection; e0: Id; e1: Id }

function isDeleted(graph: Graph, edgeId: Id) {
  return !objectKeys(graph.edges).includes(edgeId)
}

function _intersectionsForEdgeIds(graph: Graph, edgeIds: Id[]): EdgeIntersection[] {
  const intersections: EdgeIntersection[] = []

  const intersectionHashes = new Set<`${Id}_${Id}`>()

  for (let e0id of edgeIds) {
    if (isDeleted(graph, e0id)) continue
    for (let e1id of objectKeys(graph.edges)) {
      if (e0id === e1id) continue

      // Optimization to not do intersections for edge pairs we've already processed
      if (intersectionHashes.has(`${e0id}_${e1id}`)) continue
      intersectionHashes.add(`${e0id}_${e1id}`)
      intersectionHashes.add(`${e1id}_${e0id}`)

      const e0 = graph.edges[e0id]
      const e1 = graph.edges[e1id]

      const intersection = lineIntersect(
        graph.vertices[e0.start].x,
        graph.vertices[e0.start].y,
        graph.vertices[e0.end].x,
        graph.vertices[e0.end].y,
        graph.vertices[e1.start].x,
        graph.vertices[e1.start].y,
        graph.vertices[e1.end].x,
        graph.vertices[e1.end].y,
      )
      if (intersection && intersection.seg1 && intersection.seg2) {
        intersections.push({ e0: e0id, e1: e1id, intersection })
      }
    }
  }
  return intersections
}

// NOTE: Not in use at the moment, but we might introduce the optimizations here at a later stage
// const BUCKET_SIZE = 10
// function _allIntersections(graph: Graph): EdgeIntersection[] {
//   /*
//     Prepass: Sort all edges into 10m x 10m buckets. An edge can existing in multiple buckets
//    */
//   let buckets: Record<string, Id[]> = {}
//   for (let edgeId of objectKeys(graph.edges)) {
//     const edge = graph.edges[edgeId]
//     const startVertex = graph.vertices[edge.start]
//     const endVertex = graph.vertices[edge.end]
//     const minX = Math.floor(Math.min(startVertex.x, endVertex.x) / BUCKET_SIZE)
//     const maxX = Math.ceil(Math.max(startVertex.x, endVertex.x) / BUCKET_SIZE)
//     const minY = Math.floor(Math.min(startVertex.y, endVertex.y) / BUCKET_SIZE)
//     const maxY = Math.ceil(Math.max(startVertex.y, endVertex.y) / BUCKET_SIZE)
//
//     for (let i = minX; i <= maxX; i++) {
//       for (let j = minY; j <= maxY; j++) {
//         const key = `${i}_${j}`
//         if (!isDefined(buckets[key])) {
//           buckets[key] = []
//         }
//         buckets[key].push(edgeId)
//       }
//     }
//   }
//
//   let intersections: Record<string, EdgeIntersection> = {}
//   let processedIntersections = new Set<string>()
//
//   // Only look for edges that exist in the same bucket
//   for (let edgeIds of Object.values(buckets)) {
//     for (let i = 0; i < edgeIds.length - 1; i++) {
//       const e0id = edgeIds[i]
//       const e0 = graph.edges[e0id]
//       for (let j = i + 1; j < edgeIds.length; j++) {
//         const e1id = edgeIds[j]
//
//         const key = `${e0id}, ${e1id}`
//         if (processedIntersections.has(key)) continue
//         processedIntersections.add(key)
//
//         const e1 = graph.edges[e1id]
//
//         const intersection = lineIntersect(
//           graph.vertices[e0.start].x,
//           graph.vertices[e0.start].y,
//           graph.vertices[e0.end].x,
//           graph.vertices[e0.end].y,
//           graph.vertices[e1.start].x,
//           graph.vertices[e1.start].y,
//           graph.vertices[e1.end].x,
//           graph.vertices[e1.end].y,
//         )
//         if (intersection && intersection.seg1 && intersection.seg2) {
//           intersections[key] = { e0: e0id, e1: e1id, intersection }
//         }
//       }
//     }
//   }
//
//   return Object.values(intersections)
// }

function _loopToVectors(graph: Pick<Graph, "_vertices" | "_coEdges" | "_edges" | "_loops">, loopId: Id): Vector[] {
  return graph._loops[loopId].coEdgeIds.map((coEdgeId) => {
    const { start } = _getCoEdgeVertices(graph, coEdgeId)
    const vertex = graph._vertices[start]
    return {
      x: vertex.x,
      y: vertex.y,
    }
  })
}

function createCoEdges(newEdges: Record<Id, InternalEdge>, graph: Graph) {
  const newCoEdges: Record<Id, CoEdge> = {}
  for (let edgeId of objectKeys(newEdges)) {
    for (let reverse of [false, true]) {
      const edgeForCoEdge = newEdges[edgeId]
      const existingCoEdgeId = objectKeys(graph._coEdges).find((coEdgeId) => {
        const coEdge = graph._coEdges[coEdgeId]
        return coEdge.edgeId === edgeId && coEdge.reverse === reverse
      })
      const adjacentCoEdgeId = objectKeys(graph._coEdges).find((otherCoEdgeId) => {
        const coEdge = graph._coEdges[otherCoEdgeId]
        const edgeForOtherCoEdge = graph._edges[coEdge.edgeId]

        const isSameSuperEdge = edgeForOtherCoEdge.superEdgeId === edgeForCoEdge.superEdgeId
        const isSameDirection = coEdge.reverse === reverse
        const hasSharedPoint =
          edgeForOtherCoEdge.start === edgeForCoEdge.start || edgeForOtherCoEdge.end === edgeForCoEdge.end

        return isSameSuperEdge && isSameDirection && hasSharedPoint
      })

      if (existingCoEdgeId) {
        newCoEdges[existingCoEdgeId] = graph._coEdges[existingCoEdgeId]
      } else if (adjacentCoEdgeId) {
        newCoEdges[_newId()] = { edgeId, reverse, properties: graph._coEdges[adjacentCoEdgeId].properties }
      } else {
        newCoEdges[_newId()] = { edgeId, reverse }
      }
    }
  }
  return newCoEdges
}

function _updateInternals(graph: Graph, touchedEdgeIds: Id[]): Graph {
  // Use existing vertices which are unchanged
  const intersectionForRelevantEdges = _intersectionsForEdgeIds(graph, touchedEdgeIds)

  // Based on touched super edges
  const affectedSuperEdgeIds: Id[] = [...touchedEdgeIds]
  intersectionForRelevantEdges.forEach((i) => {
    if (!affectedSuperEdgeIds.includes(i.e0)) affectedSuperEdgeIds.push(i.e0)
    if (!affectedSuperEdgeIds.includes(i.e1)) affectedSuperEdgeIds.push(i.e1)
  })
  Object.values(graph._vertices).forEach((vertex) => {
    if (vertex.type !== "intersection") return
    if (touchedEdgeIds.includes(vertex.intersection.a.id) && !affectedSuperEdgeIds.includes(vertex.intersection.b.id)) {
      affectedSuperEdgeIds.push(vertex.intersection.b.id)
    }
    if (touchedEdgeIds.includes(vertex.intersection.b.id) && !affectedSuperEdgeIds.includes(vertex.intersection.a.id)) {
      affectedSuperEdgeIds.push(vertex.intersection.a.id)
    }
  })

  // Based on affected edges
  const affectedVertexIds = objectKeys(graph._vertices).filter((vertexId) => {
    const vertex = graph._vertices[vertexId]
    if (vertex.type === "vertex" && !(vertexId in graph.vertices)) return true // We only look at vertices that are still in the graph
    if (vertex.type !== "intersection") return false // We only look at intersectionVertices here
    return touchedEdgeIds.includes(vertex.intersection.a.id) || touchedEdgeIds.includes(vertex.intersection.b.id)
  })

  // Based on affected super edges
  const affectedEdgeIds = objectKeys(graph._edges).filter((edgeId) => {
    const edge = graph._edges[edgeId]
    return (
      affectedVertexIds.includes(edge.start) ||
      affectedVertexIds.includes(edge.end) ||
      affectedSuperEdgeIds.includes(edge.superEdgeId)
    )
  })

  const affectedCoEdgeIds = objectKeys(graph._coEdges).filter((coEdgeId) =>
    affectedEdgeIds.includes(graph._coEdges[coEdgeId].edgeId),
  )

  const affectedLoopIds: Id[] = objectKeys(graph._loops).filter((loopId) => {
    return graph._loops[loopId].coEdgeIds.some((coEdgeId) => affectedCoEdgeIds.includes(coEdgeId))
  })

  const affectedPolygonIds: Id[] = objectKeys(graph._polygons).filter((polygonId) => {
    return graph._polygons[polygonId].loopIds.some((loopId) => affectedLoopIds.includes(loopId))
  })

  // console.log({
  //   affectedSuperEdgeIds,
  //   affectedEdgeIds,
  //   affectedVertexIds,
  //   affectedLoopIds,
  //   affectedPolygonIds,
  // })

  const oldVertices: Record<Id, InternalVertex> = Object.fromEntries(
    Object.entries(graph._vertices).filter(([vertexId]) => !affectedVertexIds.includes(vertexId)),
  )

  const oldEdges: Record<Id, InternalEdge> = Object.fromEntries(
    Object.entries(graph._edges).filter(([edgeId]) => !affectedEdgeIds.includes(edgeId)),
  )

  const oldCoEdges: Record<Id, CoEdge> = Object.fromEntries(
    Object.entries(graph._coEdges).filter(([coEdgeId]) => !affectedCoEdgeIds.includes(coEdgeId)),
  )

  const oldLoops: Record<Id, Loop> = Object.fromEntries(
    Object.entries(graph._loops).filter(([loopId]) => !affectedLoopIds.includes(loopId)),
  )

  const oldPolygons: Record<Id, GraphPolygon> = Object.fromEntries(
    Object.entries(graph._polygons).filter(([polygonId]) => !affectedPolygonIds.includes(polygonId)),
  )

  const newVertices: Record<Id, InternalVertex> = {}
  // Update _vertices with real vertices
  for (let [vertexId, vertex] of Object.entries(graph.vertices)) {
    newVertices[vertexId] = {
      ...vertex,
      type: "vertex",
    }
  }

  // Update _vertices with new intersections
  for (let intersection of intersectionForRelevantEdges) {
    const matching = Object.entries(graph._vertices).find(([, vertex]) => {
      if (vertex.type !== "intersection") return false
      return (
        (vertex.intersection.a.id === intersection.e0 && vertex.intersection.b.id === intersection.e1) ||
        (vertex.intersection.b.id === intersection.e0 && vertex.intersection.a.id === intersection.e1)
      )
    })

    const vertexId: Id = matching ? matching[0] : _newId()

    newVertices[vertexId] = {
      type: "intersection",
      x: intersection.intersection.x,
      y: intersection.intersection.y,

      intersection: {
        a: { id: intersection.e0, distanceFromStart: intersection.intersection.ua },
        b: { id: intersection.e1, distanceFromStart: intersection.intersection.ub },
      },
    }
  }

  const _vertices = {
    ...oldVertices,
    ...newVertices,
  }

  const newEdges: Record<Id, InternalEdge> = {}

  // Update _edges based on affected superEdges
  for (let edgeId of affectedSuperEdgeIds) {
    if (isDeleted(graph, edgeId)) continue
    const edgeIntersectionVertexIds = Object.entries(_vertices) // We look at the updated vertices
      .filter(
        ([, vertex]) =>
          vertex.type === "intersection" &&
          (vertex.intersection.a.id === edgeId || vertex.intersection.b.id === edgeId),
      )
      .map(([vertexId, vertex]): [Id, number] => {
        vertex = vertex as InternalVertexIntersection
        const distanceFromStart =
          (vertex as InternalVertexIntersection).intersection.a.id === edgeId
            ? vertex.intersection.a.distanceFromStart
            : vertex.intersection.b.distanceFromStart
        return [vertexId, distanceFromStart]
      })
      .sort((a, b) => a[1] - b[1])
      .map((iv) => iv[0])

    const { start, end } = graph.edges[edgeId]

    const allVerticesForEdge = [start, ...edgeIntersectionVertexIds, end]

    for (let [start, end] of Array.sliding2(allVerticesForEdge)) {
      const sameEdgeId = getExistingEdge(graph._edges, start, end)

      const adjacentEdgeId = objectKeys(graph._edges).find((internalEdgeId) => {
        const edge = graph._edges[internalEdgeId]
        return (edge.start === start || edge.end === end) && edge.superEdgeId === edgeId
      })
      if (sameEdgeId) {
        newEdges[sameEdgeId] = graph._edges[sameEdgeId]
      } else if (adjacentEdgeId) {
        newEdges[_newId()] = {
          start,
          end,
          superEdgeId: edgeId,
          properties: graph._edges[adjacentEdgeId].properties,
        }
      } else {
        newEdges[_newId()] = { start, end, superEdgeId: edgeId, properties: graph.edges[edgeId].properties }
      }
    }
  }

  const _edges = {
    ...oldEdges,
    ...newEdges,
  }

  // Update coEdges
  const newCoEdges = createCoEdges(newEdges, graph)

  const _coEdges = {
    ...oldCoEdges,
    ...newCoEdges,
  }

  const newLoops: Record<Id, Loop> = {}
  const unaffectedLoops = objectKeys(graph._loops).filter((loopId) => !affectedLoopIds.includes(loopId))
  const coEdgesInUnaffectedLoops = unaffectedLoops.flatMap((loopId) => graph._loops[loopId].coEdgeIds)
  const loops = traversal.findLoopsBasedOnEdges({ _vertices, _edges, _coEdges }, coEdgesInUnaffectedLoops)

  for (let loop of loops) {
    const oldLoopId = objectKeys(graph._loops).find((loopId) => {
      const oldLoop = graph._loops[loopId]
      return loop.some((coEdgeId) => oldLoop.coEdgeIds.includes(coEdgeId))
    })
    if (oldLoopId) {
      if (isDefined(newLoops[oldLoopId])) {
        newLoops[_newId()] = {
          ...graph._loops[oldLoopId],
          coEdgeIds: loop,
        }
      } else {
        newLoops[oldLoopId] = {
          ...graph._loops[oldLoopId],
          coEdgeIds: loop,
        }
      }
    } else {
      newLoops[_newId()] = {
        coEdgeIds: loop,
      }
    }
  }

  const _loops = {
    ...oldLoops,
    ...newLoops,
  }

  const newPolygons: Record<Id, GraphPolygon> = {}
  for (let loopId of objectKeys(newLoops)) {
    const vectors = _loopToVectors({ _vertices, _edges, _loops, _coEdges }, loopId)
    const area = math.polygonArea(vectors)
    if (area >= -0.00001) continue

    const existingPolygonId = objectKeys(graph._polygons).find((polygonId) => {
      const existingPolygon = graph._polygons[polygonId]
      return existingPolygon.loopIds[0] === loopId
    })

    if (existingPolygonId) {
      newPolygons[existingPolygonId] = {
        ...graph._polygons[existingPolygonId],
        loopIds: [loopId],
      }
    } else {
      newPolygons[_newId()] = {
        loopIds: [loopId],
      }
    }
  }

  const _polygons = {
    ...oldPolygons,
    ...newPolygons,
  }

  return {
    ...graph,
    _vertices,
    _edges,
    _coEdges,
    _loops,
    _polygons,
    _counter: graph._counter + 1,
  }
}

export default {
  _addVertex,
  _removeVertex,
  _addVertices,
  _isOrphan,

  _addEdge,
  _addEdges,

  _updateInternals,
  _removeEdge,
  _moveVertex,
}
