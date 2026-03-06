import { v4 as uuidv4 } from "uuid"
import { removeDuplicatesVerticesAndEdges } from "./helpers/graphHelpers.js"
import type { Vec3 } from "./lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"

export type Graph = {
  edges: Record<string, GraphEdge>
  vertices: Record<string, GraphVertex>
}

export type Edge = [number, number]
export type Loop = number[]
export type Shape = {
  vertices: Vec3[]
  edges: Edge[]
  loops: Loop[]
}

export type GraphEdge = { start: string; end: string; id: string }
export type GraphVertex = { x: number; y: number; id: string }

export function makeGraphFromShape(shape: Shape): Graph {
  const vertices: Record<string, GraphVertex> = {}
  const edges: Record<string, GraphEdge> = {}
  const n = shape.vertices.length
  const vertexIDs: string[] = []
  for (let i = 0; i < n; i++) {
    const vertex = shape.vertices[i]
    const vertexID = uuidv4()
    vertices[vertexID] = { x: vertex.x, y: vertex.y, id: vertexID }
    vertexIDs.push(vertexID)
  }
  const m = shape.edges.length
  for (let i = 0; i < m; i++) {
    const edgeID = uuidv4()
    const edgeIndices = shape.edges[i]
    if (edgeIndices[0] === -1 || edgeIndices[1] === -1) continue
    const [vertexOneID, vertexTwoID] = edgeIndices.map((index) => vertexIDs[index])
    edges[edgeID] = { start: vertexOneID, end: vertexTwoID, id: edgeID }
  }

  return removeDuplicatesVerticesAndEdges({ edges, vertices })
}

function edgeConnectsToVertex(edge: Edge, vertexIndex: number): boolean {
  return edge[0] === vertexIndex || edge[1] === vertexIndex
}

export function isShapeClosed(shape: Shape) {
  return shape.vertices.every((vertex, idx) => {
    const numConnectingEdges = shape.edges.filter((edge) => edgeConnectsToVertex(edge, idx)).length
    return numConnectingEdges === 2
  })
}
