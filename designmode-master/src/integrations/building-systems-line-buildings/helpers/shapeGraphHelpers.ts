import { Matrix4, Vector3 } from "three"
import { newId } from "src/lib/element/urn"
import type { Edge, Loop, Shape } from "src/lib/three/Shape/types"

type Graph = {
  edges: Record<string, GraphEdge>
  vertices: Record<string, GraphVertex>
}
type GraphEdge = { start: string; end: string; id: string }
type GraphVertex = { x: number; y: number; id: string }

const NPD = 1e-8

function distBetweenVectors(vecOne: any, vecTwo: any) {
  return ((vecOne.x - vecTwo.x) ** 2 + (vecOne.y - vecTwo.y) ** 2) ** 0.5
}

function shapeToGraphWithOldGraphAfterSimpleVertexDrag(shape: Shape, graph: Graph): Graph {
  const draggedShapeVertex = shape.vertices.findIndex((vertexVec) => {
    const oldID = Object.keys(graph.vertices).find((vertexID) => {
      const vertex = graph.vertices[vertexID]
      const dist = ((vertex.x - vertexVec.x) ** 2 + (vertex.y - vertexVec.y) ** 2) ** 0.5
      return dist < NPD
    })
    return oldID === undefined
  })
  const oldVertex = Object.values(graph.vertices).find((vertex) => {
    return !shape.vertices.some((shapeVertexVec) => {
      const dist = ((vertex.x - shapeVertexVec.x) ** 2 + (vertex.y - shapeVertexVec.y) ** 2) ** 0.5
      return dist < NPD
    })
  })
  if (!oldVertex || draggedShapeVertex === undefined) return graph
  const shapeVertexVec = shape.vertices[draggedShapeVertex]
  const updatedVertex = { x: shapeVertexVec.x, y: shapeVertexVec.y, id: oldVertex.id }

  return { edges: graph.edges, vertices: { ...graph.vertices, [oldVertex.id]: updatedVertex } }
}

function shapeToGraphWithOldGraphAfterSimpleEdgeDrag(shape: Shape, graph: Graph): Graph {
  const oldVertices = Object.values(graph.vertices)
  const draggedVertices: any = []
  shape.vertices.forEach((vertex) => {
    const moved = !oldVertices.some((oldVertex) => {
      const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (moved) draggedVertices.push(vertex)
  })

  const draggedOldVertices: any = []
  oldVertices.forEach((oldVertex) => {
    const moved = !shape.vertices.some((vertex) => {
      const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (moved) draggedOldVertices.push(oldVertex)
  })

  const [oldVertexOne, oldVertexTwo] = draggedOldVertices
  const [vertexOne, vertexTwo] = draggedVertices

  const distOne = distBetweenVectors(oldVertexOne, vertexOne)
  const distTwo = distBetweenVectors(oldVertexTwo, vertexTwo)
  const distThree = distBetweenVectors(oldVertexOne, vertexTwo)
  const distFour = distBetweenVectors(oldVertexTwo, vertexOne)
  if (Math.abs(distOne - distTwo) < Math.abs(distThree - distFour)) {
    const updateVertexOne = { ...oldVertexOne, x: vertexOne.x, y: vertexOne.y }
    const updateVertexTwo = { ...oldVertexTwo, x: vertexTwo.x, y: vertexTwo.y }
    return {
      edges: graph.edges,
      vertices: { ...graph.vertices, [updateVertexOne.id]: updateVertexOne, [updateVertexTwo.id]: updateVertexTwo },
    }
  } else {
    const updateVertexOne = { ...oldVertexOne, x: vertexTwo.x, y: vertexTwo.y }
    const updateVertexTwo = { ...oldVertexTwo, x: vertexOne.x, y: vertexOne.y }
    return {
      edges: graph.edges,
      vertices: { ...graph.vertices, [updateVertexOne.id]: updateVertexOne, [updateVertexTwo.id]: updateVertexTwo },
    }
  }
}

////
//

function isUnChanged(shape: Shape, graph: Graph) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = Object.values(graph.vertices).length
  if (numberOfVertexes !== oldNumberOfVertexes) return false
  let numberOfMovedVertices = 0
  const oldVertices = Object.values(graph.vertices)
  shape.vertices.forEach((vertex) => {
    const moved = !oldVertices.some((oldVertex) => {
      const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (moved) numberOfMovedVertices += 1
  })
  return numberOfMovedVertices === 0
}

function isOneVertexDragged(shape: Shape, graph: Graph) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = Object.values(graph.vertices).length
  if (numberOfVertexes !== oldNumberOfVertexes) return false
  let numberOfMovedVertices = 0
  const oldVertices = Object.values(graph.vertices)
  shape.vertices.forEach((vertex) => {
    const moved = !oldVertices.some((oldVertex) => {
      const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (moved) numberOfMovedVertices += 1
  })
  return numberOfMovedVertices === 1
}

function isOneEdgeDragged(shape: Shape, graph: Graph) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = Object.values(graph.vertices).length
  if (numberOfVertexes !== oldNumberOfVertexes) return false
  let numberOfMovedVertices = 0
  const oldVertices = Object.values(graph.vertices)
  shape.vertices.forEach((vertex) => {
    const moved = !oldVertices.some((oldVertex) => {
      const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (moved) numberOfMovedVertices += 1
  })
  return numberOfMovedVertices === 2
}

function isOneVertexAdded(shape: Shape, graph: Graph) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = Object.values(graph.vertices).length
  return numberOfVertexes === oldNumberOfVertexes + 1
}

function shapeToGraphWithOldGraphAfterOneVertexAdded(shape: Shape, graph: Graph) {
  const oldVertices = Object.values(graph.vertices)
  let newVertexIndex = 0
  shape.vertices.forEach((vertex, index) => {
    const newVertex = !oldVertices.some((oldVertex) => {
      const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (newVertex) newVertexIndex = index
  })
  const newVertexId = newId()
  const vertexShape = shape.vertices[newVertexIndex]
  const newVertex = { id: newVertexId, x: vertexShape.x, y: vertexShape.y }
  const vertices = { ...graph.vertices, [newVertexId]: newVertex }

  const indexOfConnectedShapeVertices: number[] = []
  shape.edges.forEach((edge) => {
    const [indexOne, indexTwo] = edge
    if (indexOne === newVertexIndex) indexOfConnectedShapeVertices.push(indexTwo)
    if (indexTwo === newVertexIndex) indexOfConnectedShapeVertices.push(indexOne)
  })
  const neighbourVertexIDs: any = {}
  indexOfConnectedShapeVertices.forEach((vertexIndex) => {
    const shapeVertex = shape.vertices[vertexIndex]
    const oldVertex = oldVertices.find((oldVertex) => {
      const dist = ((oldVertex.x - shapeVertex.x) ** 2 + (oldVertex.y - shapeVertex.y) ** 2) ** 0.5
      return dist < NPD
    })
    if (oldVertex) neighbourVertexIDs[oldVertex.id] = oldVertex.id
  })

  const edges: any = {}
  Object.values(graph.edges).forEach((oldEdge) => {
    const start = neighbourVertexIDs[oldEdge.start]
    const end = neighbourVertexIDs[oldEdge.end]
    if (!start || !end) {
      edges[oldEdge.id] = oldEdge
    }
  })
  Object.values(neighbourVertexIDs).forEach((neighbourVertexID) => {
    const edgeID = newId()
    edges[edgeID] = { start: neighbourVertexID, end: newVertexId, id: edgeID }
  })

  return { vertices, edges }
}

// function isOneVertexRemoved(shape: Shape, graph: Graph) {
//   const numberOfVertexes = shape.vertices.length
//   const oldNumberOfVertexes = Object.values(graph.vertices).length
//   return numberOfVertexes === oldNumberOfVertexes - 1
// }

export const shapeToGraph = (shape: Shape, graph: Graph | undefined): Graph => {
  if (graph) {
    const unChanged = isUnChanged(shape, graph)
    const oneVertexDragged = isOneVertexDragged(shape, graph)
    const oneEdgeDragged = isOneEdgeDragged(shape, graph)
    const oneVertexAdded = isOneVertexAdded(shape, graph)
    // const oneVertexRemoved = isOneVertexRemoved(shape, graph)

    if (unChanged) return graph
    if (oneVertexDragged) return shapeToGraphWithOldGraphAfterSimpleVertexDrag(shape, graph)
    if (oneEdgeDragged) return shapeToGraphWithOldGraphAfterSimpleEdgeDrag(shape, graph)
    if (oneVertexAdded) return shapeToGraphWithOldGraphAfterOneVertexAdded(shape, graph)
    // console.log({ unChanged, oneVertexDragged, oneEdgeDragged, oneVertexAdded, oneVertexRemoved })
    // console.log({ shape, graph })

    // console.log("#### not supported")
  }
  const vertices: Record<string, GraphVertex> = {}
  const edges: Record<string, GraphEdge> = {}

  const vertexIds: string[] = []
  shape.vertices.forEach((shapeVertex) => {
    const vertex: GraphVertex = { x: shapeVertex.x, y: shapeVertex.y, id: newId() }
    vertices[vertex.id] = vertex
    vertexIds.push(vertex.id)
  })

  shape.edges.forEach((e) => {
    const start = vertexIds[e[0]]
    const end = vertexIds[e[1]]
    const edge: GraphEdge = { id: newId(), start, end }
    edges[edge.id] = edge
  })

  return { vertices, edges }
}

export const shapeWithIDsToGraph = (shapeWithIDs: ShapeWithIDs): Graph => {
  const vertices: Record<string, GraphVertex> = {}
  const edges: Record<string, GraphEdge> = {}

  shapeWithIDs.vertices.forEach((vertexWithID) => {
    const shapeVertex = vertexWithID.shapeVertex
    const id = vertexWithID.id
    vertices[id] = { x: shapeVertex.x, y: shapeVertex.y, id }
  })

  shapeWithIDs.edges.forEach((edgeWithID) => {
    const [start, end] = edgeWithID.shapeEdge
    const id = edgeWithID.id
    const startVertexID = shapeWithIDs.vertices[start].id
    const endVertexID = shapeWithIDs.vertices[end].id
    edges[id] = { start: startVertexID, end: endVertexID, id }
  })

  return { edges, vertices }
}

export type ShapeWithIDs = {
  vertices: {
    id: string
    shapeVertex: Vector3
  }[]
  edges: EdgeWithId[]
  loops: Loop[]
}

export type EdgeWithId = {
  id: string
  shapeEdge: Edge
}

export const graphToShapeWithIDs = (graph: Graph, z: number): ShapeWithIDs => {
  const { vertices, edges } = graph

  const vertexIdToIndexMap: any = {}
  const verticesList = Object.keys(vertices).map((vertexID, i) => {
    const vertex = vertices[vertexID]
    vertexIdToIndexMap[vertexID] = i
    const shapeVertex = new Vector3(vertex.x, vertex.y, z)
    return { id: vertexID, shapeVertex }
  })

  const edgesList: EdgeWithId[] = Object.values(edges).map((edge) => {
    const startIndex = vertexIdToIndexMap[edge.start]
    const endIndex = vertexIdToIndexMap[edge.end]
    const shapeEdge: Edge = [startIndex, endIndex]
    return { id: edge.id, shapeEdge }
  })

  return {
    vertices: verticesList,
    edges: edgesList,
    loops: [],
  }
}

export const graphToShape = (graph: Graph, z: number): Shape => {
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

export function reverseTransformShape(shape: ShapeWithIDs, worldMatrix: Matrix4) {
  const inverseWorldMatrix = worldMatrix.clone().invert()
  const vertices = shape.vertices.map((vertexWithID) => {
    const shapeVertex = vertexWithID.shapeVertex.clone().applyMatrix4(inverseWorldMatrix)
    return { ...vertexWithID, shapeVertex }
  })
  return { ...shape, vertices }
}

export function transformShapeWithIDs(shape: ShapeWithIDs, worldMatrix: Matrix4) {
  const vertices = shape.vertices.map((vertex: any) => {
    const shapeVertex = vertex.shapeVertex.clone().applyMatrix4(worldMatrix)
    return { ...vertex, shapeVertex }
  })
  return { ...shape, vertices }
}

export function transformGraph(graph: Graph, worldMatrix: Matrix4 = new Matrix4()) {
  const vertices: Record<string, { x: number; y: number; z: number; id: string }> = {}
  Object.values(graph.vertices).forEach((vertex) => {
    const transVertex = new Vector3(vertex.x, vertex.y, 0).applyMatrix4(worldMatrix)
    vertices[vertex.id] = { ...vertex, x: transVertex.x, y: transVertex.y, z: transVertex.z }
  })
  return { ...graph, vertices }
}

export function reverseTransformGraph(graph: Graph, worldMatrix: Matrix4 | undefined) {
  if (!worldMatrix) return graph
  const inverseWorldMatrix = worldMatrix.clone().invert()
  const vertices: Record<string, GraphVertex> = {}
  Object.values(graph.vertices).forEach((vertex) => {
    const transVertex = new Vector3(vertex.x, vertex.y).applyMatrix4(inverseWorldMatrix)
    vertices[vertex.id] = { ...vertex, x: transVertex.x, y: transVertex.y }
  })
  return { ...graph, vertices }
}

export function transformVertices(
  _vertices: { x: number; y: number; z: number; id: string }[],
  worldMatrix: Matrix4 | undefined,
) {
  if (!worldMatrix) return _vertices
  return _vertices.map((vertex: any) => {
    const transVertex = new Vector3(vertex.x, vertex.y, vertex.z || 0).applyMatrix4(worldMatrix)
    return { ...vertex, x: transVertex.x, y: transVertex.y, z: transVertex.z }
  })
}

export function reverseTransformVertices(
  _vertices: { x: number; y: number; z: number; id: string }[],
  worldMatrix: Matrix4 | undefined,
) {
  if (!worldMatrix) return _vertices
  const inverseWorldMatrix = worldMatrix.clone().invert()
  return _vertices.map((vertex: any) => {
    const transVertex = new Vector3(vertex.x, vertex.y, vertex.z || 0).applyMatrix4(inverseWorldMatrix)
    return { ...vertex, x: transVertex.x, y: transVertex.y, z: transVertex.z }
  })
}
