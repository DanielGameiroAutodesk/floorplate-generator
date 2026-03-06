import type { EditedShape } from "src/lib/three/Shape/shapeUtils"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { ShapeWithIDs } from "./shapeGraphHelpers"
import { v4 as uuid } from "uuid"
import type { Shape } from "src/lib/three/Shape/types"

const NPD = 1e-8

function shapeToGraphWithOldGraphAfterSimpleVertexDrag(shape: Shape, oldShapeWithIDs: ShapeWithIDs): ShapeWithIDs {
  const vertices = oldShapeWithIDs.vertices.map((oldVertex, i) => {
    const id = oldVertex.id
    const shapeVertex = shape.vertices[i]
    return { shapeVertex, id }
  })
  return { ...oldShapeWithIDs, vertices }
}

function shapeToGraphWithOldGraphAfterSimpleEdgeDrag(shape: Shape, oldShapeWithIDs: ShapeWithIDs): ShapeWithIDs {
  const vertices = oldShapeWithIDs.vertices.map((oldVertex, i) => {
    const id = oldVertex.id
    const shapeVertex = shape.vertices[i]
    return { shapeVertex, id }
  })
  return { ...oldShapeWithIDs, vertices }
}

//////
// Test functions
///

function isUnChanged(shape: EditedShape, oldShapeWithIDs: ShapeWithIDs) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = oldShapeWithIDs.vertices.length
  if (numberOfVertexes !== oldNumberOfVertexes) return false
  for (let i = 0; i < numberOfVertexes; i++) {
    const oldVertex = oldShapeWithIDs.vertices[i].shapeVertex
    const vertex = shape.vertices[i]
    if (!vertex) return false
    const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
    if (dist > NPD) return false
  }
  return true
}

function isOneVertexDragged(shape: EditedShape, oldShapeWithIDs: ShapeWithIDs) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = oldShapeWithIDs.vertices.length
  if (numberOfVertexes !== oldNumberOfVertexes) return false

  let numberOfMovedVertices = 0
  for (let i = 0; i < numberOfVertexes; i++) {
    const oldVertex = oldShapeWithIDs.vertices[i].shapeVertex
    const vertex = shape.vertices[i]
    if (!vertex) return false
    const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
    if (dist > NPD) numberOfMovedVertices += 1
  }
  return numberOfMovedVertices === 1
}

function isOneEdgeDragged(shape: EditedShape, oldShapeWithIDs: ShapeWithIDs) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = oldShapeWithIDs.vertices.length
  if (numberOfVertexes !== oldNumberOfVertexes) return false

  let numberOfMovedVertices = 0
  for (let i = 0; i < numberOfVertexes; i++) {
    const oldVertex = oldShapeWithIDs.vertices[i].shapeVertex
    const vertex = shape.vertices[i]
    if (!vertex) return false
    const dist = ((oldVertex.x - vertex.x) ** 2 + (oldVertex.y - vertex.y) ** 2) ** 0.5
    if (dist > NPD) numberOfMovedVertices += 1
  }
  return numberOfMovedVertices === 2
}

function isOneVertexAdded(shape: EditedShape, oldShapeWithIDs: ShapeWithIDs) {
  const numberOfVertexes = shape.vertices.length
  const oldNumberOfVertexes = oldShapeWithIDs.vertices.length
  return numberOfVertexes === oldNumberOfVertexes + 1
}

function shapeToGraphWithOldGraphAfterOneVertexAdded(shape: Shape, oldShapeWithIDs: ShapeWithIDs) {
  const vertices = oldShapeWithIDs.vertices.map((oldVertex, i) => {
    const id = oldVertex.id
    const shapeVertex = shape.vertices[i]
    return { shapeVertex, id }
  })
  const newVertexIndex = shape.vertices.length - 1
  const newShapeVertex = shape.vertices[newVertexIndex]
  const newVertex = { shapeVertex: newShapeVertex, id: uuid() }
  vertices.push(newVertex)

  const newShapeEdges = shape.edges.filter((edge) => {
    const [start, end] = edge
    return start === newVertexIndex || end === newVertexIndex
  })

  const newEdges = newShapeEdges.map((edge) => {
    return { shapeEdge: edge, id: uuid() }
  })
  const removeEdge = newShapeEdges.map((edge) => {
    const [start, end] = edge
    if (start === newVertexIndex) return end
    return start
  })
  const edgesWithoutRemoveEdge = oldShapeWithIDs.edges.filter((edgeWithID) => {
    if (!removeEdge.includes(edgeWithID.shapeEdge[0])) return true
    return !removeEdge.includes(edgeWithID.shapeEdge[1])
  })

  const edges = [...edgesWithoutRemoveEdge, ...newEdges]

  return { ...oldShapeWithIDs, vertices, edges }
}

function isOneVertexRemoved(shape: EditedShape) {
  const numberOfVertexes = shape.vertices.length
  for (let i = 0; i < numberOfVertexes; i++) {
    const vertex = shape.vertices[i]
    if (vertex === undefined) return true
  }
  return false
}

export function shapeToShapeWithIDs(shape: Shape): ShapeWithIDs {
  const vertices = shape.vertices.map((vertex) => {
    return { shapeVertex: vertex, id: uuid() }
  })
  const edges = shape.edges.map((edge) => {
    return { shapeEdge: edge, id: uuid() }
  })
  return { ...shape, vertices, edges }
}

export const mergeShapeWithOldShapeWithIDs = (
  shape: EditedShape,
  oldShapeWithIDs: ShapeWithIDs | undefined,
): ShapeWithIDs => {
  if (!oldShapeWithIDs) return shapeToShapeWithIDs(ShapeUtils.pruneEditedShape(shape))

  const unChanged = isUnChanged(shape, oldShapeWithIDs)
  const oneVertexDragged = isOneVertexDragged(shape, oldShapeWithIDs)
  const oneEdgeDragged = isOneEdgeDragged(shape, oldShapeWithIDs)
  const oneVertexAdded = isOneVertexAdded(shape, oldShapeWithIDs)
  const oneVertexRemoved = isOneVertexRemoved(shape)

  // console.log({ unChanged, oneVertexDragged, oneEdgeDragged, oneVertexAdded, oneVertexRemoved })
  if (unChanged) return oldShapeWithIDs
  if (oneVertexDragged) return shapeToGraphWithOldGraphAfterSimpleVertexDrag(shape as Shape, oldShapeWithIDs)
  if (oneEdgeDragged) return shapeToGraphWithOldGraphAfterSimpleEdgeDrag(shape as Shape, oldShapeWithIDs)
  if (oneVertexAdded) return shapeToGraphWithOldGraphAfterOneVertexAdded(shape as Shape, oldShapeWithIDs)
  if (oneVertexRemoved) {
    console.log("TODO add support for removing points")
    return oldShapeWithIDs
  }

  console.log("#### not supported")
  return shapeToShapeWithIDs(ShapeUtils.pruneEditedShape(shape))
}
