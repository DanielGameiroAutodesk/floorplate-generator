import { simpleUnitVector, isClockwise } from "./geometry"
import { mod } from "./numpy"

export function argMin(array) {
  let argmin = 0
  let min_value = 99999999999999
  for (let i = 0; i < array.length; i++) {
    if (array[i] < min_value) {
      argmin = i
      min_value = array[i]
    }
  }
  return argmin
}

function getIndexOf(element, list) {
  let index = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i] === element) return i
  }
  return index
}

function getOneDirectionalVertexNeighbourMap(vertices, edges) {
  const vertexNeighbourMap = {}
  Object.keys(vertices).forEach(function (id) {
    vertexNeighbourMap[id] = []
  })
  Object.keys(edges).forEach(function (id) {
    vertexNeighbourMap[edges[id].start].push(edges[id].end)
  })
  return vertexNeighbourMap
}

function getDirectionOfTwoVertices(v1, v2) {
  return simpleUnitVector([v1.x, v1.y], [v2.x, v2.y])
}

function scoreDirection(currentDirection, candidateDirection) {
  const prevAngle = mod(Math.atan2(-currentDirection[1], -currentDirection[0]), Math.PI * 2)
  const candidateAngle = mod(Math.atan2(candidateDirection[1], candidateDirection[0]), Math.PI * 2)
  return mod(prevAngle - candidateAngle, Math.PI * 2)
}

function getNextVertexInCycleForOneDirectionalVertexMap(
  prevVertexId,
  currentVertexId,
  vertices,
  edges,
  vertexNeighbourMap,
) {
  const prevVertex = vertices[prevVertexId]
  const currentVertex = vertices[currentVertexId]
  const currentDirection = getDirectionOfTwoVertices(prevVertex, currentVertex)
  const neighboursIds = vertexNeighbourMap[currentVertexId]

  if (neighboursIds.length === 0) {
    return null
  }
  const scores = []
  for (let i = 0; i < neighboursIds.length; i++) {
    const p = neighboursIds[i]
    let nextDirection = getDirectionOfTwoVertices(currentVertex, vertices[p])
    let currentScore = scoreDirection(currentDirection, nextDirection)
    scores.push(currentScore)
  }

  const minScoreIndex = argMin(scores)
  const nextId = neighboursIds[minScoreIndex]
  const indexToRemove = vertexNeighbourMap[currentVertexId].indexOf(nextId)
  vertexNeighbourMap[currentVertexId].splice(indexToRemove, 1)
  return nextId
}

function drawStartId(vertexNeighbourMap) {
  return Object.keys(vertexNeighbourMap).filter((e) => vertexNeighbourMap[e].length > 0)[0]
}

function getClosedPolygonFromVertexIDs(vertexIDs, startIndex, vertices) {
  const polygonVertexIDs = vertexIDs.slice(startIndex)
  const polygon = polygonVertexIDs.map((vertexID) => [vertices[vertexID].x, vertices[vertexID].y])
  polygon.push(polygon[0])
  return polygon
}

function getPolygonsFromOneDirectionalGraph(vertices, edges, vertexNeighbourMap, startId, noVertices) {
  let prevId = startId
  let currentId = vertexNeighbourMap[startId].shift()
  let polygons = []
  let visitedVerticesIDs = [prevId, currentId]
  let counter = 0

  while (counter < 2 * noVertices) {
    const nextId = getNextVertexInCycleForOneDirectionalVertexMap(
      prevId,
      currentId,
      vertices,
      edges,
      vertexNeighbourMap,
    )
    if (!nextId) {
      break
    }
    if (visitedVerticesIDs.includes(nextId)) {
      const indexOfVisitedVertex = getIndexOf(nextId, visitedVerticesIDs)
      const polygon = getClosedPolygonFromVertexIDs(visitedVerticesIDs, indexOfVisitedVertex, vertices)
      polygons.push(polygon)
      if (indexOfVisitedVertex === 0) break
      prevId = visitedVerticesIDs[indexOfVisitedVertex - 1]
      visitedVerticesIDs = visitedVerticesIDs.slice(0, indexOfVisitedVertex)
    } else {
      prevId = currentId
    }
    visitedVerticesIDs.push(nextId)
    currentId = nextId
    counter++
  }
  return polygons
}

export function getAllCounterClockWisePolygonsFromOneDirectionalGraph(vertices, edges) {
  const vertexNeighbourMap = getOneDirectionalVertexNeighbourMap(vertices, edges)
  const noVertices = Object.keys(vertices).length
  let finished = false
  let allPolygons = []
  let startId = drawStartId(vertexNeighbourMap)
  let counter = 0
  while (!finished && counter < 2 * noVertices) {
    let polygons = getPolygonsFromOneDirectionalGraph(vertices, edges, vertexNeighbourMap, startId, noVertices)
    allPolygons.push(...polygons)
    startId = drawStartId(vertexNeighbourMap)
    if (!startId) finished = true
    counter++
  }
  allPolygons = allPolygons.filter((p) => !isClockwise(p))

  return allPolygons
}
