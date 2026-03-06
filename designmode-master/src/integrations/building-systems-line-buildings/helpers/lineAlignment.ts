import { Vector3 } from "three"
import type { ShapeWithIDs } from "./shapeGraphHelpers"

import type { Edge, Loop, Shape } from "src/lib/three/Shape/types"
import type { Graph, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import {
  getLineAngles,
  getLineSegmentLengths,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/lineHelpers"
import type { Vec2 } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers"
import { getBlockDistanceForSimpleCorner } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/lineBuilding9000/blockingDistance"

type Line = Vector3[]
type PointXY = { x: number; y: number }

function pointPointDistanceXY(pointOne: { x: number; y: number }, pointTwo: { x: number; y: number }) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

function getUnitVectorXY(startPoint: PointXY, endPoint: PointXY) {
  const distance = ((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2) ** 0.5
  if (distance === 0) return { x: 0, y: 0 }
  const dx = (endPoint.x - startPoint.x) / distance
  const dy = (endPoint.y - startPoint.y) / distance
  return { x: dx, y: dy }
}

function getUnitNormalVectorXY(startPoint: PointXY, endPoint: PointXY) {
  const unitVector = getUnitVectorXY(startPoint, endPoint)
  const dx = -unitVector.y
  const dy = unitVector.x
  return { x: dx, y: dy }
}

export function isLineClosed(line: { x: number; y: number }[]) {
  const pointOne = line[0]
  const pointTwo = line[line.length - 1]

  const dist = (pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2

  return dist < 1e-8
}

//////
// Buffer line
///

function getUnitNormalVectors(line: Line) {
  const unitNormals = []
  const n = line.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = line[i]
    const p1 = line[(i + 1) % n]
    const normal = getUnitNormalVectorXY(p0, p1)
    unitNormals.push(normal)
  }
  return unitNormals
}

function getCornerShiftsOpen(line: Line) {
  const unitNormals = getUnitNormalVectors(line)
  const n = line.length
  const cornerShifts = [unitNormals[0]]
  for (let i = 0; i < n - 2; i++) {
    const normalOne = unitNormals[i]
    const normalTwo = unitNormals[i + 1]
    let x = normalOne.x + normalTwo.x
    let y = normalOne.y + normalTwo.y
    const l = x * normalOne.x + y * normalOne.y
    x = x / l
    y = y / l
    cornerShifts.push({ x, y })
  }
  cornerShifts.push(unitNormals[n - 2])
  return cornerShifts
}

function getCornerShiftsClosed(line: Line) {
  const unitNormals = getUnitNormalVectors(line)
  const n = line.length
  const cornerShifts = []
  const m = unitNormals.length
  for (let i = -1; i < n - 1; i++) {
    const normalOne = unitNormals[(i + m) % m]
    const normalTwo = unitNormals[(i + 1) % m]
    let x = normalOne.x + normalTwo.x
    let y = normalOne.y + normalTwo.y
    const l = x * normalOne.x + y * normalOne.y
    x = x / l
    y = y / l
    cornerShifts.push({ x, y })
  }
  return cornerShifts
}

function bufferOpenLine(line: Line, bufferDist: number) {
  const cornerShifts = getCornerShiftsOpen(line)
  return line.map((point, i) => {
    const x = point.x + cornerShifts[i].x * bufferDist
    const y = point.y + cornerShifts[i].y * bufferDist
    return new Vector3(x, y, point.z)
  })
}

function bufferClosedLine(line: Line, bufferDist: number) {
  const cornerShifts = getCornerShiftsClosed(line)
  const bufferedLine = line.map((point, i) => {
    const x = point.x + cornerShifts[i].x * bufferDist
    const y = point.y + cornerShifts[i].y * bufferDist
    return new Vector3(x, y, point.z)
  })
  bufferedLine[bufferedLine.length - 1] = bufferedLine[0]
  return bufferedLine
}

function bufferLine(line: Line, bufferDist: number) {
  if (line.length <= 1) return line
  const lineClosed = isLineClosed(line)
  if (lineClosed) {
    return bufferClosedLine(line, bufferDist)
  }
  return bufferOpenLine(line, bufferDist)
}

//////
// Line to SHape
///

function lineToShape(line: Line, elevation = 0) {
  let edges: Edge[] = []
  let vertices: Vector3[] = []
  let loops: Loop[] = []

  const closed = isLineClosed(line)
  if (!closed) {
    const numberOfVertices = line.length
    vertices = line.map((point) => {
      return new Vector3(point.x, point.y, elevation)
    })
    for (let i = 0; i < numberOfVertices - 1; i++) {
      edges.push([i, i + 1])
    }
  } else {
    const numberOfVertices = line.length - 1
    const loop: Loop = []
    for (let i = 0; i < numberOfVertices; i++) {
      const point = line[i]
      const vertex = new Vector3(point.x, point.y, elevation)
      vertices.push(vertex)
      edges.push([i, (i + 1) % numberOfVertices])
      loop.push(i)
    }
  }

  return { vertices, edges, loops, faces: [] }
}

//////
//
///

function loopFromVertexEdge(
  startVertexIndex: number,
  startEdgeIndex: number,
  edges: [number, number][],
  vertices: Vector3[],
  usedEdgeIndexes: { [i: number]: boolean },
) {
  const vLineIndexes: number[] = []
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

function graphToLinesIds(graph: Graph) {
  const { vertices, edges } = graph
  const vertexList = Object.values(vertices)

  const shapeVertices = vertexList.map((vertex) => {
    return new Vector3(vertex.x, vertex.y)
  })
  const shapeEdges: Edge[] = Object.values(edges).map((edge) => {
    const startVertexIndex = vertexList.findIndex((vertex) => vertex.id === edge.start)
    const endVertexIndex = vertexList.findIndex((vertex) => vertex.id === edge.end)
    return [startVertexIndex, endVertexIndex]
  })
  const shape: Shape = { vertices: shapeVertices, edges: shapeEdges, loops: [] }
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

export function getLinesFromGraph(graph: Graph) {
  return graphToLinesIds(graph).map((lineIDs) => {
    return lineIDs.map((vertexID) => {
      return graph.vertices[vertexID]
    })
  })
}

export function bufferGraphLine(graph: Graph, bufferDist: number): Graph {
  const lineIDs = graphToLinesIds(graph)[0]
  const line: Line = lineIDs.map((id) => {
    const vertex = graph.vertices[id]
    return new Vector3(vertex.x, vertex.y)
  })
  const bufferedLine = bufferLine(line, bufferDist)
  let vertices: Record<string, GraphVertex> = {}
  for (let i = 0; i < lineIDs.length; i++) {
    const vertexID = lineIDs[i]
    const vector = bufferedLine[i]
    vertices[vertexID] = { id: vertexID, x: vector.x, y: vector.y }
  }
  return { ...graph, vertices }
}

export function moveGraphToCenterLine(
  graph: Graph,
  parameters: { width: number; lineAlignment: "left" | "center" | "right" },
): Graph {
  const { width, lineAlignment } = parameters
  if (lineAlignment === "left") {
    const bufferDist = -0.5 * width
    return bufferGraphLine(graph, bufferDist)
  }
  if (lineAlignment === "right") {
    const bufferDist = 0.5 * width
    return bufferGraphLine(graph, bufferDist)
  }
  return graph
}

export function moveGraphToSideLine(
  graph: Graph,
  parameters: { width: number; lineAlignment: "left" | "center" | "right" },
): Graph {
  const { width, lineAlignment } = parameters
  if (lineAlignment === "left") {
    const bufferDist = 0.5 * width
    return bufferGraphLine(graph, bufferDist)
  }
  if (lineAlignment === "right") {
    const bufferDist = -0.5 * width
    return bufferGraphLine(graph, bufferDist)
  }
  return graph
}

function shapeToLinesIndices(shape: Shape) {
  const { vertices, edges } = shape
  if (vertices.length <= 1) {
    const line = vertices.map((_, i) => {
      return i
    })
    return [line]
  }
  const lines: number[][] = []

  const usedVertexIndexes: { [index: number]: boolean } = {}
  const usedEdgeIndexes: { [index: number]: boolean } = {}

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

function shapeToLines(shape: Shape): Line[] {
  const { vertices } = shape
  const linesIndices = shapeToLinesIndices(shape)
  return linesIndices.map((lineIndices) => {
    return lineIndices.map((vertexIndex) => {
      const vertex = vertices[vertexIndex]
      return new Vector3(vertex.x, vertex.y, vertex.z)
    })
  })
}

export function moveShapeToCenterLine(
  shape: Shape,
  parameters: { width: number; lineAlignment: "left" | "center" | "right" },
): Shape {
  let line = shapeToLines(shape)[0]
  const { width, lineAlignment } = parameters

  if (lineAlignment === "left") {
    const bufferDist = -0.5 * width
    line = bufferLine(line, bufferDist)
  }
  if (lineAlignment === "right") {
    const bufferDist = 0.5 * width
    line = bufferLine(line, bufferDist)
  }
  const elevation = line[0]?.z || 0
  return lineToShape(line, elevation)
}

export function shapeWithIDsToShape(shapeWithIDs: ShapeWithIDs): Shape {
  const vertices = shapeWithIDs.vertices.map((vertex) => {
    return vertex.shapeVertex
  })
  const edges = shapeWithIDs.edges.map((edge) => {
    return edge.shapeEdge
  })
  return { ...shapeWithIDs, vertices, edges }
}

export function getLineFromShape(shape: Shape) {
  const linesIndices = shapeToLinesIndices(shape)[0]
  return linesIndices.map((vertexIndex: number) => {
    const vertex = shape.vertices[vertexIndex]
    return { x: vertex.x, y: vertex.y }
  })
}

export function moveShapeWithIDsToCenterLine(
  shapeWithIDs: ShapeWithIDs,
  parameters: { width: number; lineAlignment: "left" | "center" | "right" },
): ShapeWithIDs {
  const sideShape = shapeWithIDsToShape(shapeWithIDs)
  const linesIndices = shapeToLinesIndices(sideShape)[0]
  let sideLine = linesIndices.map((vertexIndex: number) => {
    const vertex = sideShape.vertices[vertexIndex]
    return new Vector3(vertex.x, vertex.y, vertex.z)
  })

  const { width, lineAlignment } = parameters

  let line = [...sideLine]

  if (lineAlignment === "left") {
    const bufferDist = -0.5 * width
    line = bufferLine(line, bufferDist)
  }
  if (lineAlignment === "right") {
    const bufferDist = 0.5 * width
    line = bufferLine(line, bufferDist)
  }

  const sideVertices = shapeWithIDs.vertices.map((vertex, index: number) => {
    const indexTwo = linesIndices.findIndex((value) => index === value)
    const sideVector = line[indexTwo]
    return { ...vertex, shapeVertex: sideVector }
  })
  return { ...shapeWithIDs, vertices: sideVertices }
}

export function moveShapeWithIDsToSideLine(
  shapeWithIDs: ShapeWithIDs,
  parameters: { width: number; lineAlignment: "left" | "center" | "right" },
) {
  const centerShape = shapeWithIDsToShape(shapeWithIDs)
  const linesIndices = shapeToLinesIndices(centerShape)[0]
  let centerLine = linesIndices.map((vertexIndex: number) => {
    const vertex = centerShape.vertices[vertexIndex]
    return new Vector3(vertex.x, vertex.y, vertex.z)
  })

  const { width, lineAlignment } = parameters

  let line = [...centerLine]
  if (lineAlignment === "left") {
    const bufferDist = 0.5 * width
    line = bufferLine(line, bufferDist)
  }
  if (lineAlignment === "right") {
    const bufferDist = -0.5 * width
    line = bufferLine(line, bufferDist)
  }

  const sideVertices = shapeWithIDs.vertices.map((vertex, index: number) => {
    const indexTwo = linesIndices.findIndex((value) => index === value)
    const sideVector = line[indexTwo]
    return { ...vertex, shapeVertex: sideVector }
  })
  return { ...shapeWithIDs, vertices: sideVertices }
}

///////
// Line alignment validation
///

const SHARPEST_ANGLE = 0.9 * Math.PI

export function getValidLineAlignments(graph: Graph, width: number) {
  const centerLine = getLinesFromGraph(graph)[0]
  const rightValid = isLineAlignmentValid(centerLine, width, "right")
  const leftValid = isLineAlignmentValid(centerLine, width, "left")
  return { center: true, right: rightValid, left: leftValid }
}

function isLineAlignmentValid(centerLine: { x: number; y: number }[], width: number, lineAlignment: string) {
  const closedLine = isLineClosed(centerLine)
  if (closedLine) {
    const cutLine = centerLine.slice(0, centerLine.length - 1)
    const angles = getLineAngles(cutLine as [Vec2, Vec2], closedLine)
    const edgeLengths = getLineSegmentLengths(cutLine as [Vec2, Vec2], closedLine)
    const blockingDistances = angles.map((angle) => {
      if (angle >= 0 && lineAlignment === "right") return 0
      if (angle <= 0 && lineAlignment === "left") return 0
      return getBlockDistanceForSimpleCorner(width, angle)
    })
    const n = cutLine.length
    for (let i = 0; i < cutLine.length; i++) {
      const block = blockingDistances[i] + blockingDistances[(i + 1) % n]
      const edgeLength = edgeLengths[i]
      if (block >= edgeLength) return false
    }
    for (let i = 0; i < cutLine.length; i++) {
      const angle = angles[i]
      if (angle > SHARPEST_ANGLE && lineAlignment === "left") return false
      if (angle < -SHARPEST_ANGLE && lineAlignment === "right") return false
    }
  } else {
    const angles = getLineAngles(centerLine as [Vec2, Vec2], closedLine)
    const edgeLengths = getLineSegmentLengths(centerLine as [Vec2, Vec2], closedLine)
    const blockingDistances = angles.map((angle) => {
      if (angle >= 0 && lineAlignment === "right") return 0
      if (angle <= 0 && lineAlignment === "left") return 0
      return getBlockDistanceForSimpleCorner(width, angle)
    })
    const n = centerLine.length
    for (let i = 0; i < centerLine.length - 1; i++) {
      const block = blockingDistances[i] + blockingDistances[(i + 1) % n]
      const edgeLength = edgeLengths[i]
      if (block >= edgeLength) return false
    }
    for (let i = 0; i < centerLine.length - 1; i++) {
      const angle = angles[i]
      if (angle > SHARPEST_ANGLE && lineAlignment === "left") return false
      if (angle < -SHARPEST_ANGLE && lineAlignment === "right") return false
    }
  }
  return true
}

function isLineValid(line: any, width: number, lineAlignment: string) {
  if (line.length <= 1) return false
  if (line.length === 2) return true
  const closedLine = isLineClosed(line)
  if (closedLine) {
    const cutLine = line.slice(0, line.length - 1)
    const angles = getLineAngles(cutLine, closedLine)
    const edgeLengths = getLineSegmentLengths(line, closedLine)
    const blockingDistances = angles.map((angle) => {
      if (angle >= 0 && lineAlignment === "left") return 0
      if (angle <= 0 && lineAlignment === "right") return 0
      return getBlockDistanceForSimpleCorner(width, angle)
    })
    const n = cutLine.length
    for (let i = 0; i < cutLine.length; i++) {
      const block = blockingDistances[i] + blockingDistances[(i + 1) % n]
      const edgeLength = edgeLengths[i]
      if (block >= edgeLength) return false
    }
    for (let i = 0; i < cutLine.length; i++) {
      const angle = angles[i]
      if (angle > SHARPEST_ANGLE && lineAlignment === "left") return false
      if (angle < -SHARPEST_ANGLE && lineAlignment === "right") return false
    }
  } else {
    const angles = getLineAngles(line, closedLine)
    const edgeLengths = getLineSegmentLengths(line, closedLine)
    const blockingDistances = angles.map((angle) => {
      if (angle >= 0 && lineAlignment === "left") return 0
      if (angle <= 0 && lineAlignment === "right") return 0
      return getBlockDistanceForSimpleCorner(width, angle)
    })
    const n = line.length
    for (let i = 0; i < line.length - 1; i++) {
      const block = blockingDistances[i] + blockingDistances[(i + 1) % n]
      const edgeLength = edgeLengths[i]
      if (block >= edgeLength) return false
    }
    for (let i = 0; i < line.length - 1; i++) {
      const angle = angles[i]
      if (angle > SHARPEST_ANGLE && lineAlignment === "left") return false
      if (angle < -SHARPEST_ANGLE && lineAlignment === "right") return false
    }
  }
  return true
}

export function isShapeValid(shape: Shape, width: number, lineAlignment: string) {
  if (lineAlignment === "center") return true
  const line = getLineFromShape(shape)
  return isLineValid(line, width, lineAlignment)
}

function duplicatePointsInGraph(graph: Graph) {
  for (let edge of Object.values(graph.edges)) {
    const startVertex = graph.vertices[edge.start]
    const endVertex = graph.vertices[edge.end]
    const samePoint = pointPointDistanceXY(startVertex, endVertex) < 1e-8
    if (samePoint) return true
  }
  return false
}

export function isGraphValid(sideGraph: Graph, width: number, lineAlignment: string) {
  const duplicatedPoint = duplicatePointsInGraph(sideGraph)
  if (duplicatedPoint) return false
  if (lineAlignment === "center") return true
  const line = getLinesFromGraph(sideGraph)[0]
  return isLineValid(line, width, lineAlignment)
}
