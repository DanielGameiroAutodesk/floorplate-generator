import { argMax, isClockwise, mod, polygonArea, simpleUnitVector } from "./geometry.js"
import { v4 as uuidv4 } from "uuid"
import { vertexIdToPoint } from "./graphHelpers.js"

function getVertexNeighbourMap(vertices, edges) {
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

  const minScoreIndex = argMax(scores)
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
  return Object.keys(vertexNeighbourMap)
    .filter((e) => vertexNeighbourMap[e].length > 0)
    .sort((a, b) => vertexNeighbourMap[a].length - vertexNeighbourMap[b].length)[0]
}

function getOneChainOfVertexIds(vertices, edges, vertexNeighbourMap, firstId, noVertices) {
  let prevId = firstId
  let currentId = vertexNeighbourMap[firstId].shift()
  const secondId = currentId
  let steps = [prevId, currentId]
  let counter = 0
  while (counter < 2 * noVertices) {
    const nextId = getNextVertexInCycle(prevId, currentId, vertices, edges, vertexNeighbourMap)
    if (!nextId) {
      steps.pop()
      break
    }

    if (nextId === firstId && currentId !== secondId) {
      //if area => loop detected, otherwise one dimensional path and we want to continue
      const polygon = steps.map((id) => vertexIdToPoint(id, { vertices, edges }))
      if (polygonArea(polygon) > 0.0001) break
    }
    steps.push(nextId)
    prevId = currentId
    currentId = nextId
    counter++
  }
  return steps
}

function getStepsFromVertexIds(vertexIds, edgeValues) {
  return vertexIds.map((vertexId, i, l) => {
    const edgeId = getEdgeIDFromVertexIDs(edgeValues, vertexId, l[mod(i + 1, l.length)])
    return { vertexId, edgeId }
  })
}

export function getGraphTraversalSteps(graph) {
  const vertexNeighbourMap = getVertexNeighbourMap(graph.vertices, graph.edges)
  const edgeValues = Object.values(graph.edges)

  const noVertices = Object.keys(graph.vertices).length
  let finished = false
  const setOfSteps = {}
  let startId = drawStartId(vertexNeighbourMap)
  let counter = 0
  while (!finished && counter < 2 * noVertices) {
    const vertexIds = getOneChainOfVertexIds(
      graph.vertices,
      graph.edges,
      vertexNeighbourMap,
      startId,
      noVertices,
      edgeValues,
      true,
    )

    setOfSteps[uuidv4()] = getStepsFromVertexIds(vertexIds, edgeValues)

    startId = drawStartId(vertexNeighbourMap)
    if (!startId) finished = true
    counter++
  }
  return setOfSteps
}

export function checkWindingOfSteps(setOfSteps, graph) {
  return Object.entries(setOfSteps).map(([key, steps]) => {
    const polygon = steps.map((step) => vertexIdToPoint(step.vertexId, graph))
    return {
      key,
      polygon,
      area: polygonArea(polygon),
      winding: isClockwise(polygon),
    }
  })
}
