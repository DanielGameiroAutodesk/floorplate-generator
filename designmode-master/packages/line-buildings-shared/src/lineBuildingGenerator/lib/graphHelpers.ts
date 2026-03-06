import { getAngle, pointPointDistance } from "./helpers/geometry.js"
import { antiIntersectionOfArrays, intersectionOfArrays } from "./helpers/helpers.js"
import type { EdgePlus } from "./graphBuilding3000.js"
import type { Graph, GraphEdge, GraphVertex } from "../../shapeHelpers.js"
import type { Point } from "./lineBuilding9000/BuildingTypes.js"

function getVertexNeighboursWithEdgesForVertex(vertexId: string, graph: Graph) {
  let edges: Record<string, GraphEdge> = {}
  const vertexIds = Object.values(graph.edges).reduce<any[]>((acc, cur) => {
    if (cur.start === vertexId) {
      acc.push(graph.vertices[cur.end].id)
      edges[cur.id] = cur
    }
    if (cur.end === vertexId) {
      acc.push(graph.vertices[cur.start].id)
      edges[cur.id] = cur
    }
    return acc
  }, [])
  return { edges, vertexIds }
}

function depthFirstSearch(graph: Graph, vertexId: string, vertexVisitedMap: Record<string, boolean>) {
  if (vertexVisitedMap[vertexId]) return null // node is already visited, get out of here.
  let subGraph: { vertices: Record<string, GraphVertex>; edges: Record<string, GraphEdge> } = {
    vertices: {},
    edges: {},
  }
  vertexVisitedMap[vertexId] = true
  subGraph.vertices[vertexId] = graph.vertices[vertexId]
  const { edges: neighbourEdges, vertexIds: neighbourVertexIds } = getVertexNeighboursWithEdgesForVertex(
    vertexId,
    graph,
  )
  subGraph.edges = neighbourEdges
  neighbourVertexIds.forEach((id) => {
    let resultGraph = depthFirstSearch(graph, id, vertexVisitedMap)
    if (resultGraph !== null) {
      subGraph.vertices = { ...subGraph.vertices, ...resultGraph.vertices }
      subGraph.edges = { ...subGraph.edges, ...resultGraph.edges }
    }
  })
  return subGraph
}

export function getConnectedComponentsFromGraph(graph: Graph) {
  // Assumes no dangling vertices in input graph
  let subGraphs: Graph[] = [] // array of connected vertices
  const verticesKeys = Object.keys(graph.vertices)
  let visited = verticesKeys.reduce<{ [key: string]: boolean }>((a, c) => {
    a[c] = false
    return a
  }, {})
  verticesKeys.forEach((id) => {
    let subGraph = depthFirstSearch(graph, id, visited)
    if (subGraph !== null) {
      subGraphs.push(subGraph)
    }
  })
  return subGraphs
}

export function findConnectedEdges(graph: Graph) {
  const disconnectedVertices: Record<string, GraphVertex> = {}
  const connectedVertices: Record<string, GraphVertex> = {}

  Object.keys(graph.vertices).forEach((id) => {
    if (Object.values(graph.edges).some((e) => e.start === id || e.end === id)) {
      connectedVertices[id] = graph.vertices[id]
    } else {
      disconnectedVertices[id] = graph.vertices[id]
    }
  })
  const validGraph = { vertices: connectedVertices, edges: graph.edges }
  return getConnectedComponentsFromGraph(validGraph)
}

export function getVertexEdgeMap(edges: Record<string, EdgePlus>) {
  const vertexEdgeMap: Record<string, string[]> = {}
  Object.values(edges).forEach((edge) => {
    const startVertex = edge.start
    if (vertexEdgeMap[startVertex]) vertexEdgeMap[startVertex].push(edge.id)
    else vertexEdgeMap[startVertex] = [edge.id]

    const endVertex = edge.end
    if (vertexEdgeMap[endVertex]) vertexEdgeMap[endVertex].push(edge.id)
    else vertexEdgeMap[endVertex] = [edge.id]
  })

  return vertexEdgeMap
}

export function getEdgeLength(edge: EdgePlus, vertices: Record<string, GraphVertex>) {
  const [p1, p2] = [edge.start, edge.end].map((vertexID) => [vertices[vertexID].x, vertices[vertexID].y])
  return pointPointDistance(p1 as Point, p2 as Point)
}

export function getEdgeLine(graph: Graph, edgeId: string) {
  const edge = graph.edges[edgeId]
  const startVertex = graph.vertices[edge.start]
  const endVertex = graph.vertices[edge.end]
  const p0 = [startVertex.x, startVertex.y]
  const p1 = [endVertex.x, endVertex.y]
  return [p0, p1]
}

export function getAngleBetweenEdges(edge1: GraphEdge, edge2: GraphEdge, vertices: Record<string, GraphVertex>) {
  const vertices1 = [edge1.start, edge1.end]
  const vertices2 = [edge2.start, edge2.end]
  const p1 = intersectionOfArrays(vertices1, vertices2).map((id) => [vertices[id].x, vertices[id].y])[0] as Point
  const [p0, p2] = antiIntersectionOfArrays(vertices1, vertices2).map((id) => [vertices[id].x, vertices[id].y]) as [
    Point,
    Point,
  ]
  if (p0 === undefined) return Math.PI
  return getAngle(p0, p1, p2)
}
