import { argMin, getCCWPolygon, isClockwise, mod, polygonArea, simpleUnitVector } from "./geometry.js"

const NPD = 0.01

function getIndexOf(element, list) {
  let index = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i] === element) return i
  }
  return index
}

export function getVertexNeighbourMap(vertices, edges) {
  const vertexNeighbourMap = {}
  Object.keys(vertices).forEach(function (id) {
    vertexNeighbourMap[id] = []
  })

  Object.keys(edges).forEach(function (id) {
    vertexNeighbourMap[edges[id].start].push(edges[id].end)
    vertexNeighbourMap[edges[id].end].push(edges[id].start)
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

function getNextVertexInCycle(prevVertexId, currentVertexId, vertices, edges, vertexNeighbourMap) {
  const prevVertex = vertices[prevVertexId]
  const currentVertex = vertices[currentVertexId]

  const currentDirection = getDirectionOfTwoVertices(prevVertex, currentVertex)
  const neighboursIds = vertexNeighbourMap[currentVertexId].filter((id) => id !== prevVertexId)

  if (neighboursIds.length === 0) {
    if (vertexNeighbourMap[currentVertexId].length === 0) return null
    neighboursIds.push(prevVertexId)
  }

  const scores = neighboursIds.map((id) => {
    const nextDirection = getDirectionOfTwoVertices(currentVertex, vertices[id])
    return scoreDirection(currentDirection, nextDirection)
  })

  const minScoreIndex = argMin(scores)
  const nextId = neighboursIds[minScoreIndex]
  const indexToRemove = vertexNeighbourMap[currentVertexId].indexOf(nextId)
  vertexNeighbourMap[currentVertexId].splice(indexToRemove, 1)
  return nextId
}

function getEdgeIDFromVertexIDs(edgeValues, vertexID1, vertexID2) {
  for (let i = 0; i < edgeValues.length; i++) {
    const e = edgeValues[i]
    if ((e.start === vertexID1 && e.end === vertexID2) || (e.end === vertexID1 && e.start === vertexID2)) return e.id
  }
  return null
}

function drawStartId(vertexNeighbourMap) {
  return Object.keys(vertexNeighbourMap).filter((e) => vertexNeighbourMap[e].length > 0)[0]
}

function getOnePolygon(vertices, edges, vertexNeighbourMap, startId, noVertices, edgeValues, forceCCWPolygon = true) {
  let prevId = startId
  let currentId = vertexNeighbourMap[startId].shift()
  const firstId = currentId
  let polygon = [
    [vertices[prevId].x, vertices[prevId].y],
    [vertices[currentId].x, vertices[currentId].y],
  ]
  let edgeIDs = []

  let foundEdgeId

  foundEdgeId = getEdgeIDFromVertexIDs(edgeValues, vertices[prevId].id, vertices[currentId].id)
  edgeIDs.push(foundEdgeId)
  let counter = 0
  let firstPointAddedToEndOfPolygon = false
  while (counter < 2 * noVertices) {
    const nextId = getNextVertexInCycle(prevId, currentId, vertices, edges, vertexNeighbourMap)
    if (!nextId) {
      firstPointAddedToEndOfPolygon = true
      break
    }
    if (nextId === startId && currentId !== firstId) break
    polygon.push([vertices[nextId].x, vertices[nextId].y])
    foundEdgeId = getEdgeIDFromVertexIDs(edgeValues, vertices[currentId].id, vertices[nextId].id)
    edgeIDs.push(foundEdgeId)
    prevId = currentId
    currentId = nextId
    counter++
  }
  if (!firstPointAddedToEndOfPolygon) {
    polygon.push(polygon[0])
    foundEdgeId = getEdgeIDFromVertexIDs(edgeValues, vertices[currentId].id, vertices[startId].id)
    edgeIDs.push(foundEdgeId)
  }
  const originEdgeIds = edgeIDs.map((id) => edges[id].originEdge)
  const res = forceCCWPolygon
    ? { polygon: getCCWPolygon(polygon), edgeIDs: edgeIDs }
    : { polygon, edgeIDs: originEdgeIds }
  return res
}

function getAllPolygonsFromGraph(graph, vertexNeighbourMap, edgeValueStreetGraph, getCCWPolygons) {
  const noVertices = Object.keys(graph.vertices).length
  let finished = false
  let polygonsWithBelongingEdgeIDs = []
  let startId = drawStartId(vertexNeighbourMap)
  let counter = 0
  while (!finished && counter < 2 * noVertices) {
    const { polygon, edgeIDs } = getOnePolygon(
      graph.vertices,
      graph.edges,
      vertexNeighbourMap,
      startId,
      noVertices,
      edgeValueStreetGraph,
      getCCWPolygons,
    )

    if (polygon.length > 3 && polygonArea(polygon) > NPD) polygonsWithBelongingEdgeIDs.push({ polygon, edgeIDs })

    startId = drawStartId(vertexNeighbourMap)
    if (!startId) finished = true
    counter++
  }
  return polygonsWithBelongingEdgeIDs
}

export function graphToPolygonsWithOriginEdgesMapping(graph, edgeValues, getCCWPolygons = true) {
  return getAllPolygonsFromGraph(graph, getVertexNeighbourMap(graph.vertices, graph.edges), edgeValues, getCCWPolygons)
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

function getClosedPolygonFromVertexIDs(vertexIDs, startIndex, vertices, edges) {
  const edgeIDs = []
  const edgeValues = Object.values(edges)
  const polygonVertexIDs = vertexIDs.slice(startIndex)
  const n = polygonVertexIDs.length
  const polygon = polygonVertexIDs.map((vertexID, i, l) => {
    edgeIDs.push(getEdgeIDFromVertexIDs(edgeValues, vertexID, l[mod(i + 1, n)]))
    return [vertices[vertexID].x, vertices[vertexID].y]
  })
  polygon.push(polygon[0])

  const originEdgeIds = edgeIDs.map((id) => edges[id].originEdge)
  return { polygon, edgeIDs: originEdgeIds }
}

function getPolygonsFromOneDirectionalGraph(vertices, edges, vertexNeighbourMap, startId, noVertices) {
  let prevId = startId
  let currentId = vertexNeighbourMap[startId].shift()
  let polygonsWithEdgeIDs = []
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
      const polygonWithEdgeIDs = getClosedPolygonFromVertexIDs(
        visitedVerticesIDs,
        indexOfVisitedVertex,
        vertices,
        edges,
      )
      polygonsWithEdgeIDs.push(polygonWithEdgeIDs)
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
  return polygonsWithEdgeIDs
}

export function getOrientedPolygonsWithEdgeIDsFromDirectedGraph(
  vertices,
  edges,
  desiredWindingIsCounterClockWise = true,
) {
  const vertexNeighbourMap = getOneDirectionalVertexNeighbourMap(vertices, edges)
  const noVertices = Object.keys(vertices).length
  let finished = false
  let allPolygonsWithEdgeIDs = []
  let startId = drawStartId(vertexNeighbourMap)
  let counter = 0
  while (!finished && counter < 2 * noVertices) {
    let polygonsWithEdgeIDs = getPolygonsFromOneDirectionalGraph(
      vertices,
      edges,
      vertexNeighbourMap,
      startId,
      noVertices,
    )
    allPolygonsWithEdgeIDs.push(...polygonsWithEdgeIDs)
    startId = drawStartId(vertexNeighbourMap)
    if (!startId) finished = true
    counter++
  }
  allPolygonsWithEdgeIDs = allPolygonsWithEdgeIDs.filter((polygonWithEdgeID) => {
    return desiredWindingIsCounterClockWise
      ? !isClockwise(polygonWithEdgeID.polygon)
      : isClockwise(polygonWithEdgeID.polygon)
  })

  return allPolygonsWithEdgeIDs
}
