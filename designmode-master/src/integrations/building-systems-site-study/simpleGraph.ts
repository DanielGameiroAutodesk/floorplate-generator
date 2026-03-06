import type { Shape } from "src/lib/three/Shape/types"
import { Vector3 } from "three"

export type Vertex = { x: number; y: number; id: string }
export type Edge = { start: string; end: string; id: string }
export type Vertices = { [id: string]: Vertex }
export type Edges = { [id: string]: Edge }
export type SimpleGraph = {
  vertices: Vertices
  edges: Edges
}

export type Point = { x: number; y: number }
export const graphToShape = (graph: SimpleGraph, z: number = 0): Shape => {
  const { vertices, edges } = graph

  const vertexIdToIndexMap: any = {}
  const verticesList = Object.keys(vertices).map((vertexID, i) => {
    const vertex = vertices[vertexID]
    vertexIdToIndexMap[vertexID] = i
    return new Vector3(vertex.x, vertex.y, z)
  })

  const edgesList: [number, number][] = Object.values(edges).map((edge) => {
    const startIndex = vertexIdToIndexMap[edge.start]
    const endIndex = vertexIdToIndexMap[edge.end]
    return [startIndex, endIndex]
  })

  return {
    vertices: verticesList,
    edges: edgesList,
    loops: [],
  }
}

export const graphToLineGraphs = (graph: SimpleGraph): SimpleGraph[] => {
  const lineGraphs: SimpleGraph[] = []
  const usedEdges: {
    [edgeId: string]: boolean | undefined
  } = {}

  for (let edge of Object.values(graph.edges)) {
    if (usedEdges[edge.id]) continue
    usedEdges[edge.id] = true
    let edges: Edges = { [edge.id]: edge }
    let vertices: Vertices = { [edge.start]: graph.vertices[edge.start], [edge.end]: graph.vertices[edge.end] }
    let lineGraph = { edges, vertices }
    lineGraphs.push(lineGraph)
  }

  return lineGraphs
}
