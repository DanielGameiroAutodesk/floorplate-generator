import { getLinesFromGraph, getVertexEdgeMap } from "./graphUtils.js"
import { coordinateTransformPoints, getLineLength, makePolygonClockwise } from "./geoUtils.js"
import { getGroupPolygonWithHolesFromGraph } from "./unitFunctions.js"
import type { Unit } from "../../lineBuildingGenerator/lib/sectionFill/getSectionFill.js"
import type { Graph, GraphEdge, GraphVertex } from "../../shapeHelpers.js"

let idCounter = 0
function createLocalId() {
  return (idCounter++).toString()
}
function snapCloseVertices(graph: Graph, snappingDist = 1e-2) {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const vertexList = Object.values(vertices)
  const n = vertexList.length
  const verticesToDelete = []
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const { x: x0, y: y0, id: vertexZeroID } = vertexList[i]
      const { x: x1, y: y1, id: vertexOneID } = vertexList[j]
      const dist = ((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5
      if (dist < snappingDist) {
        vertices[vertexZeroID].x = x1
        vertices[vertexZeroID].y = y1

        vertexEdgeMap[vertexZeroID].forEach((edgeID) => {
          const edge = edges[edgeID]
          if (edge.start === vertexZeroID) edge.start = vertexOneID
          if (edge.end === vertexZeroID) edge.end = vertexOneID
        })
        verticesToDelete.push(vertexZeroID)
        break
      }
    }
  }
  verticesToDelete.forEach((vertexID) => {
    delete vertices[vertexID]
  })
}

function addVerticesTwoLines(graph: Graph, snappingDist = 1e-3) {
  const { edges, vertices } = graph
  const listOfEdges = Object.values(edges)
  listOfEdges.forEach((edge) => {
    const startVertex = vertices[edge.start]
    const endVertex = vertices[edge.end]
    const edgeLength = getLineLength([startVertex, endVertex])
    const closeVertices = []
    for (let vertex of Object.values(vertices)) {
      if (edge.start === vertex.id || edge.end === vertex.id) continue
      const [{ x: s, y: t }] = coordinateTransformPoints([vertex], startVertex, [startVertex, endVertex])
      if (s <= 0 || s >= edgeLength) continue
      if (Math.abs(t) > snappingDist) continue
      closeVertices.push({ id: vertex.id, dist: s })
    }
    closeVertices.sort((a, b) => a.dist - b.dist)
    let startID = edge.start
    for (let vertex of closeVertices) {
      const newEdgeID = createLocalId()
      edges[newEdgeID] = { id: newEdgeID, start: startID, end: vertex.id }
      edge.start = vertex.id
      startID = vertex.id
    }
  })
}

function removeFacingEdges(graph: Graph) {
  const { edges } = graph
  const markedEdgeIDs: Record<string, boolean> = {}

  const edgeList = Object.values(edges)
  const n = edgeList.length
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const edgeOne = edgeList[i]
      const edgeTwo = edgeList[j]
      if (edgeOne.start === edgeTwo.end && edgeTwo.start === edgeOne.end) {
        markedEdgeIDs[edgeOne.id] = true
        markedEdgeIDs[edgeTwo.id] = true
      }
    }
  }
  Object.keys(markedEdgeIDs).forEach((edgeID) => {
    delete edges[edgeID]
  })
}

export function findSurroundingPolygonOfConnectedGroupUnits(unitsInGroup: Unit[]) {
  const polygons = unitsInGroup.flatMap((unit) => {
    return [unit.polygon, ...unit.holes.map((hole) => makePolygonClockwise(hole))]
  })
  const vertices: Record<string, GraphVertex> = {}
  const edges: Record<string, GraphEdge> = {}
  const graph = { vertices, edges }
  polygons.forEach((polygon) => {
    let n = polygon.length
    for (let i = 0; i < n; i++) {
      const pointOne = polygon[i]
      const pointTwo = polygon[(i + 1) % n]
      const edgeLength = getLineLength([pointOne, pointTwo])
      if (edgeLength === 0) continue

      const vertexOneID = createLocalId()
      const vertexTwoID = createLocalId()
      const edgeID = createLocalId()

      vertices[vertexOneID] = { id: vertexOneID, x: pointOne.x, y: pointOne.y }
      vertices[vertexTwoID] = { id: vertexTwoID, x: pointTwo.x, y: pointTwo.y }
      edges[edgeID] = { id: edgeID, start: vertexOneID, end: vertexTwoID }
    }
  })

  snapCloseVertices(graph)
  addVerticesTwoLines(graph)
  removeFacingEdges(graph)

  const lines = getLinesFromGraph(graph)
  const polygonWithHoles = getGroupPolygonWithHolesFromGraph(graph)
  return { lines, polygonWithHoles }
}
