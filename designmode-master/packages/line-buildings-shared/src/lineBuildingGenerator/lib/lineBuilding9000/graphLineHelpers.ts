import type { Graph, GraphVertex } from "../../../shapeHelpers.js"

export type Vec2 = {
  x: number
  y: number
}

export type Vec3 = {
  x: number
  y: number
  z: number
}

export type Shape = {
  vertices: Vec2[]
  edges: number[][]
  loops: number[]
}

export type LineDataFromGraph = {
  line: GraphVertex[]
  lineVertexIDs: string[]
  lineEdgeIds: string[]
  closedLine: boolean
}

function loopFromVertexEdge(
  startVertexIndex: number,
  startEdgeIndex: number,
  edges: number[][],
  vertices: Vec2[],
  usedEdgeIndexes: Record<number, boolean>,
) {
  const vLineIndexes = []
  let edgeIndex = startEdgeIndex
  let currentIndex = startVertexIndex
  for (let i = 0; i < 100; i++) {
    if (edgeIndex === -1 || usedEdgeIndexes[edgeIndex]) break
    const edge = edges[edgeIndex]
    usedEdgeIndexes[edgeIndex] = true
    const nextVertexIndex = edge[0] === currentIndex ? edge[1] : edge[0]
    vLineIndexes.push(nextVertexIndex)
    if (nextVertexIndex === startVertexIndex) break
    currentIndex = nextVertexIndex
    edgeIndex = edges.findIndex((edge, i) => {
      const [indexOne, indexTwo] = edge
      if (indexTwo === -1 || indexOne === -1) return false
      return (indexOne === currentIndex || indexTwo === currentIndex) && !usedEdgeIndexes[i]
    })
  }
  return vLineIndexes
}

function shapeToLinesIndices(shape: Shape) {
  const { vertices, edges } = shape
  if (vertices.length <= 1) {
    const line = vertices.map((_, i) => {
      return i
    })
    return [line]
  }
  const lines = []

  const usedVertexIndexes: Record<number, boolean> = {}
  const usedEdgeIndexes: Record<number, boolean> = {}

  for (let startVertexIndex = 0; startVertexIndex < vertices.length; startVertexIndex++) {
    if (usedVertexIndexes[startVertexIndex]) continue
    let vLineIndexes = []
    let currentIndex = 0
    vLineIndexes.push(currentIndex)

    const startEdgeIndexes = edges
      .map((edge, i) => i)
      .filter((edgeIndex) => {
        const edge = edges[edgeIndex]
        const [indexOne, indexTwo] = edge
        if (indexTwo === -1 || indexOne === -1) return false
        return indexOne === startVertexIndex || indexTwo === startVertexIndex
      })

    if (startEdgeIndexes.length === 1) {
      const startEdgeIndex = startEdgeIndexes[0]
      const rightLine = loopFromVertexEdge(startVertexIndex, startEdgeIndex, edges, vertices, usedEdgeIndexes)
      vLineIndexes = [currentIndex, ...rightLine]
    }
    if (startEdgeIndexes.length === 2) {
      const startEdgeIndexOne = startEdgeIndexes[0]
      const rightLine = loopFromVertexEdge(startVertexIndex, startEdgeIndexOne, edges, vertices, usedEdgeIndexes)
      const startEdgeIndexTwo = startEdgeIndexes[1]
      const leftLine = loopFromVertexEdge(startVertexIndex, startEdgeIndexTwo, edges, vertices, usedEdgeIndexes)
      vLineIndexes = [...leftLine.reverse(), currentIndex, ...rightLine]
    }
    vLineIndexes.forEach((vertexIndex) => {
      usedVertexIndexes[vertexIndex] = true
    })
    lines.push(vLineIndexes)
  }
  return lines
}

function graphToLinesIds(graph: Graph) {
  const { vertices, edges } = graph
  const vertexList = Object.values(vertices)

  const shapeVertices = vertexList.map((vertex) => {
    return { x: vertex.x, y: vertex.y } as Vec2
  })
  const shapeEdges = Object.values(edges).map((edge) => {
    const startVertexIndex = vertexList.findIndex((vertex) => vertex.id === edge.start)
    const endVertexIndex = vertexList.findIndex((vertex) => vertex.id === edge.end)
    return [startVertexIndex, endVertexIndex]
  })
  const shape = { vertices: shapeVertices, edges: shapeEdges, loops: [] } as Shape
  return shapeToLinesIndices(shape).map((line) => {
    const lineIDs = line.map((index) => {
      return vertexList[index].id
    })
    if (lineIDs.length <= 1) return lineIDs
    const reverseDirection = Object.values(edges).some((edge) => {
      return edge.end === lineIDs[0] && edge.start === lineIDs[1]
    })
    if (reverseDirection) return lineIDs.reverse()
    return lineIDs
  })
}

export function graphToLineData(graph: Graph): LineDataFromGraph {
  let lineVertexIDs = graphToLinesIds(graph)[0]
  if (lineVertexIDs[0] === lineVertexIDs[lineVertexIDs.length - 1]) {
    lineVertexIDs = lineVertexIDs.slice(0, lineVertexIDs.length - 1)
  }
  const line = lineVertexIDs.map((vertexID) => {
    return graph.vertices[vertexID]
  })
  const lineEdgeIds = []
  let closedLine = false
  const n = lineVertexIDs.length
  for (let i = 0; i < lineVertexIDs.length; i++) {
    const vertexIdOne = lineVertexIDs[i % n]
    const vertexIdTwo = lineVertexIDs[(i + 1) % n]
    const edge = Object.values(graph.edges).find((edge) => {
      return edge.start === vertexIdOne && edge.end === vertexIdTwo
    })
    if (edge) lineEdgeIds.push(edge.id)
    if (edge && i === lineVertexIDs.length - 1) closedLine = true
  }

  return { line, lineVertexIDs, lineEdgeIds, closedLine }
}
