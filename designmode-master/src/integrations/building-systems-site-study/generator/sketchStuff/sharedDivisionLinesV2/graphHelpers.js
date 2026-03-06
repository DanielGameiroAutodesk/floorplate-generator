import {
  argMin,
  closedPolygonCentroid,
  dotProduct,
  getAngleBetweenPoints,
  getCCWPolygon,
  getCrossProduct,
  getDotProduct,
  getUnitNormalVector,
  getUnitVector,
  getVectorFromPointToPoint,
  isClockwise,
  isLineSegmentPartiallyInsidePolygon,
  lineSegmentsIntersectionPoint,
  mod,
  movePointAlongVector,
  pointInPolygon,
  pointPointDistance,
  polygonArea,
} from "./geometry.js"
import { v4 as uuidv4 } from "uuid"
import {
  getOrientedPolygonsWithEdgeIDsFromDirectedGraph,
  graphToPolygonsWithOriginEdgesMapping,
} from "./polygonsFromGraph.js"
import { checkWindingOfSteps, getGraphTraversalSteps } from "./graphTraversal.js"
import { getGraphIntersectedWithSelf } from "./graphIntersection.js"

function deepCopy(object) {
  return JSON.parse(JSON.stringify(object))
}

export const getVertex2EdgeMap = (graph) => {
  const neighbourMap = {}
  Object.keys(graph.vertices).forEach((vertexId) => (neighbourMap[vertexId] = []))
  Object.values(graph.edges).forEach((edge) => {
    neighbourMap[edge.start].push({ edgeId: edge.id, neighbourVertexId: edge.end })
    neighbourMap[edge.end].push({ edgeId: edge.id, neighbourVertexId: edge.start })
  })
  return neighbourMap
}

export const vertexIdToPoint = (vertexId, graph) => {
  const vertex = graph.vertices[vertexId]
  return [vertex.x, vertex.y]
}

function getEdgePoints(edge, vertices) {
  const p1 = [vertices[edge.start].x, vertices[edge.start].y]
  const p2 = [vertices[edge.end].x, vertices[edge.end].y]
  return [p1, p2]
}

function adjustOffsetPointsIfIntersectsNeighbourEdges(_p1, _p2, prevEdgeLine, nextEdgeLine) {
  let [p1, p2] = [_p1, _p2]

  const intersection1 = lineSegmentsIntersectionPoint(prevEdgeLine[0], prevEdgeLine[1], p1, p2)
  if (intersection1) {
    p1 = intersection1
  }

  const intersection2 = lineSegmentsIntersectionPoint(nextEdgeLine[0], nextEdgeLine[1], p1, p2)
  if (intersection2) {
    p2 = intersection2
  }

  return [p1, p2]
}

function checkIfStepsMakeInvalidEdgePolygons(
  offsetP1,
  offsetP2,
  edgeP1,
  edgeP2,
  thisEdge,
  prevEdge,
  nextEdge,
  vertices,
) {
  let prevStepInvalid = false
  let thisStepInvalid = false
  let nextStepInvalid = false

  if (thisEdge.width <= prevEdge.width && thisEdge.width <= nextEdge.width)
    return { prevStepInvalid, thisStepInvalid, nextStepInvalid }

  const rectangle = getCCWPolygon([offsetP1, offsetP2, edgeP2, edgeP1])
  const prevEdgeLine = getEdgePoints(prevEdge, vertices)
  const nextEdgeLine = getEdgePoints(nextEdge, vertices)

  if (thisEdge.width > prevEdge.width && isLineSegmentPartiallyInsidePolygon(prevEdgeLine, rectangle, false)) {
    thisStepInvalid = true
    prevStepInvalid = true
  }
  if (thisEdge.width > nextEdge.width && isLineSegmentPartiallyInsidePolygon(nextEdgeLine, rectangle, false)) {
    thisStepInvalid = true
    nextStepInvalid = true
  }

  return { prevStepInvalid, thisStepInvalid, nextStepInvalid }
}

export const getOffsetGraphWithBaseEdgesMapping = (traversalSteps, baseGraph) => {
  const stepUnitVectors = traversalSteps.map((step, i, l) => {
    const point = vertexIdToPoint(step.vertexId, baseGraph)
    const nextPoint = vertexIdToPoint(l[(i + 1) % l.length].vertexId, baseGraph)
    return getUnitVector(point, nextPoint)
  })
  const crossProducts = stepUnitVectors.map((u, i, l) => {
    return getCrossProduct(l[mod(i - 1, l.length)], u)
  })

  const verticesList = []
  const edgeList = []
  const n = traversalSteps.length

  let prevStepInvalid, thisStepInvalid, nextStepInvalid
  traversalSteps.forEach((step, i) => {
    const p1 = vertexIdToPoint(step.vertexId, baseGraph)
    const edge = baseGraph.edges[step.edgeId]
    const nextVertex = edge.start === step.vertexId ? edge.end : edge.start
    const p2 = vertexIdToPoint(nextVertex, baseGraph)
    const normalVector = getUnitNormalVector(p1, p2)
    let offsetP1 = movePointAlongVector(p1, normalVector, -0.5 * edge.width)
    let offsetP2 = movePointAlongVector(p2, normalVector, -0.5 * edge.width)

    const nextEdge = baseGraph.edges[traversalSteps[mod(i + 1, n)].edgeId]
    const nextEdgeLine = getEdgePoints(nextEdge, baseGraph.vertices)
    const prevEdge = baseGraph.edges[traversalSteps[mod(i - 1, n)].edgeId]
    const prevEdgeLine = getEdgePoints(prevEdge, baseGraph.vertices)
    ;[offsetP1, offsetP2] = adjustOffsetPointsIfIntersectsNeighbourEdges(offsetP1, offsetP2, prevEdgeLine, nextEdgeLine)

    const thisStepIsInvalidFromPrevRound = nextStepInvalid
    ;({ prevStepInvalid, thisStepInvalid, nextStepInvalid } = checkIfStepsMakeInvalidEdgePolygons(
      offsetP1,
      offsetP2,
      p1,
      p2,
      edge,
      prevEdge,
      nextEdge,
      baseGraph.vertices,
    ))

    if (prevStepInvalid && i > 0) delete edgeList[edgeList.length - 1]["originEdge"]

    const v1 = { id: uuidv4(), x: offsetP1[0], y: offsetP1[1] }
    const v2 = { id: uuidv4(), x: offsetP2[0], y: offsetP2[1] }

    const prevVertex = verticesList.length && verticesList[verticesList.length - 1]
    const connectingVertex = crossProducts[i] < 0 && { id: uuidv4(), x: p1[0], y: p1[1] }
    if (connectingVertex) {
      verticesList.push(connectingVertex)
    }

    if (prevVertex && connectingVertex) {
      const connectingEdge1 = { id: uuidv4(), start: prevVertex.id, end: connectingVertex.id }
      const connectingEdge2 = { id: uuidv4(), start: connectingVertex.id, end: v1.id }
      verticesList.push(connectingVertex)
      edgeList.push(connectingEdge1, connectingEdge2)
    } else if (prevVertex) {
      const connectingEdge = { id: uuidv4(), start: prevVertex.id, end: v1.id }
      edgeList.push(connectingEdge)
    } else if (connectingVertex) {
      const connectingEdge = { id: uuidv4(), start: connectingVertex.id, end: v1.id }
      edgeList.push(connectingEdge)
    }

    verticesList.push(v1, v2)
    const originEdge = thisStepInvalid || thisStepIsInvalidFromPrevRound ? undefined : step.edgeId

    const offsetEdge = { id: uuidv4(), start: v1.id, end: v2.id, originEdge }
    edgeList.push(offsetEdge)
  })

  if (nextStepInvalid) delete edgeList[0]["originEdge"]

  const firstVertex = verticesList[0]
  const lastVertex = verticesList[verticesList.length - 1]
  const lastConnectingEdge = { id: uuidv4(), end: firstVertex.id, start: lastVertex.id }
  edgeList.push(lastConnectingEdge)

  const vertices = verticesList.reduce((vertices, vertex) => {
    vertices[vertex.id] = vertex
    return vertices
  }, {})
  const edges = edgeList.reduce((edges, edge) => {
    edges[edge.id] = edge
    return edges
  }, {})

  return { vertices, edges }
}

export function getPolygonDictAndEdgeMap(polygonWithEdgeIds) {
  const edgeMap = {}
  const polygonPointsWithIDs = polygonWithEdgeIds.polygonPointsWithIDs
  const edgeIDs = polygonWithEdgeIds.edgeIDs
  const n = edgeIDs.length
  edgeIDs.forEach((edgeID, i) => {
    if (!edgeID) return
    const line = [polygonPointsWithIDs[i].id, polygonPointsWithIDs[(i + 1) % n].id]
    if (edgeMap[edgeID]) edgeMap[edgeID].push(line)
    else edgeMap[edgeID] = [line]
  })

  const polygonDict = {}
  polygonPointsWithIDs.forEach((p) => {
    polygonDict[p.id] = { point: p.point }
  })
  return { polygonDict, edgeMap }
}

function getEdgeRectangle(line1ID, line2ID, envelopePolygonPointDict) {
  const NUMERICAL_PRECISION = 1e-5
  const [id1, id2] = line1ID
  const [id3, id4] = line2ID
  const p1 = envelopePolygonPointDict[id1].point
  const p2 = envelopePolygonPointDict[id2].point
  const p3 = envelopePolygonPointDict[id3].point
  const p4 = envelopePolygonPointDict[id4].point
  const unitVec = getUnitVector(p1, p2)

  // return null if lines don't overlap along unitVector
  const vec24 = getVectorFromPointToPoint(p2, p4)
  const dot24 = getDotProduct(unitVec, vec24)
  const vec13 = getVectorFromPointToPoint(p1, p3)
  const dot13 = getDotProduct(unitVec, vec13)
  if (dot24 >= 0 || dot13 <= 0) return null

  const rectangle = [
    { oldId: id1, newId: null },
    { oldId: id2, newId: null },
    { oldId: id3, newId: null },
    { oldId: id4, newId: null },
  ]

  const dot14 = dotProduct(unitVec, getVectorFromPointToPoint(p1, p4))
  if (dot14 > NUMERICAL_PRECISION) {
    const id = uuidv4()
    envelopePolygonPointDict[id] = { point: movePointAlongVector(p1, unitVec, dot14) }
    rectangle[0].newId = id
  }

  if (dot14 < -NUMERICAL_PRECISION) {
    const id = uuidv4()
    envelopePolygonPointDict[id] = { point: movePointAlongVector(p4, unitVec, -dot14) }
    rectangle[3].newId = id
  }

  const dot23 = dotProduct(unitVec, getVectorFromPointToPoint(p2, p3))
  if (dot23 < -NUMERICAL_PRECISION) {
    const id = uuidv4()
    envelopePolygonPointDict[id] = { point: movePointAlongVector(p2, unitVec, dot23) }
    rectangle[1].newId = id
  }

  if (dot23 > NUMERICAL_PRECISION) {
    const id = uuidv4()
    envelopePolygonPointDict[id] = { point: movePointAlongVector(p3, unitVec, -dot23) }
    rectangle[2].newId = id
  }
  return rectangle
}

export function getEdgeRectanglePolygonsDict(polygonDict, edgeMapDict, baseGraph) {
  const edgePolygonsDict = {}

  Object.keys(baseGraph.edges).forEach((edgeId) => {
    const lineIds = edgeMapDict[edgeId]
    if (!lineIds || lineIds.length === 0) {
      return null
    }
    if (lineIds.length === 1) return null

    const rectDict = getEdgeRectangle(lineIds[0], lineIds[1], polygonDict)
    if (rectDict === null) return null

    const polygon = rectDict.map((ids) => polygonDict[ids.newId ? ids.newId : ids.oldId].point)
    edgePolygonsDict[edgeId] = { id: edgeId, polygon, rectDict }
  })
  return edgePolygonsDict
}

function getVertexNeighboursWithEdgesForVertex(vertexId, graph) {
  let edges = {}
  const vertexIds = Object.values(graph.edges).reduce((acc, cur) => {
    if (cur.start === vertexId) {
      acc.push(graph.vertices[cur.end].id)
      edges[cur.id] = cur
    }
    if (cur.end === vertexId) {
      acc.push(graph.vertices[cur.start].id)
      edges[cur.id] = cur
    }
    return acc
  }, [])
  return { edges, vertexIds }
}

function depthFirstSearch(graph, vertexId, vertexVisitedMap) {
  if (vertexVisitedMap[vertexId]) return null // node is already visited, get out of here.
  let subGraph = { vertices: {}, edges: {} }
  vertexVisitedMap[vertexId] = true
  subGraph.vertices[vertexId] = graph.vertices[vertexId]
  const { edges: neighbourEdges, vertexIds: neighbourVertexIds } = getVertexNeighboursWithEdgesForVertex(
    vertexId,
    graph,
  )
  subGraph.edges = neighbourEdges
  neighbourVertexIds.forEach((id) => {
    let resultGraph = depthFirstSearch(graph, id, vertexVisitedMap)
    if (resultGraph !== null) {
      subGraph.vertices = { ...subGraph.vertices, ...resultGraph.vertices }
      subGraph.edges = { ...subGraph.edges, ...resultGraph.edges }
    }
  })
  return subGraph
}

function getConnectedComponentsFromGraph(graph) {
  // Assumes no dangling vertices in input graph
  let subGraphs = [] // array of connected vertices
  const verticesKeys = Object.keys(graph.vertices)
  let visited = verticesKeys.reduce((a, c) => {
    a[c] = false
    return a
  }, {})
  verticesKeys.forEach((id) => {
    let subGraph = depthFirstSearch(graph, id, visited)
    if (subGraph !== null) {
      subGraphs.push(subGraph)
    }
  })
  return subGraphs
}

export function findConnectedEdges(graph) {
  const disconnectedVertices = {}
  const connectedVertices = {}

  Object.keys(graph.vertices).forEach((id) => {
    if (Object.values(graph.edges).some((e) => e.start === id || e.end === id)) {
      connectedVertices[id] = graph.vertices[id]
    } else {
      disconnectedVertices[id] = graph.vertices[id]
    }
  })
  const validGraph = { vertices: connectedVertices, edges: graph.edges }
  return getConnectedComponentsFromGraph(validGraph)
}

function getSortedNeighbours(neighbours, vertexId, baseGraph) {
  const firstVertexId = neighbours[0].neighbourVertexId
  return neighbours.sort(
    (a, b) =>
      getAngleBetweenPoints(
        vertexIdToPoint(firstVertexId, baseGraph),
        vertexIdToPoint(vertexId, baseGraph),
        vertexIdToPoint(b.neighbourVertexId, baseGraph),
      ) -
      getAngleBetweenPoints(
        vertexIdToPoint(firstVertexId, baseGraph),
        vertexIdToPoint(vertexId, baseGraph),
        vertexIdToPoint(a.neighbourVertexId, baseGraph),
      ),
  )
}

const getIndexHelper = (rectDict, first) => {
  let index = null
  for (let i = 0; i < 4; i++) {
    if (rectDict.rectDict[i].oldId === first.id && rectDict.rectDict[i].newId) {
      index = i
    }
  }
  return index
}

function findTrueSteps(_rawSteps, collapsedEdgesDict, pairOfEdgesToPolygonPointsDict) {
  const stepPairs = []
  const rawSteps = _rawSteps.map((step) => {
    const baseGraphEdgeId = step.edgeId.split("#")[0]
    return { ...step, edgeId: baseGraphEdgeId }
  })
  const n = rawSteps.length

  let nextEdge
  for (let i = 0; i < rawSteps.length; i++) {
    const currentEdge = rawSteps[i].edgeId
    nextEdge = rawSteps[mod(i + 1, rawSteps.length)].edgeId
    if (pairOfEdgesToPolygonPointsDict[currentEdge + nextEdge]) {
      stepPairs.push([currentEdge, nextEdge])
    } else {
      if (currentEdge === nextEdge) continue
      if (collapsedEdgesDict[nextEdge]) {
        let finished = false
        let j = i + 2
        let counter = 0
        while (!finished && counter < n) {
          nextEdge = rawSteps[mod(j, n)].edgeId
          if (nextEdge === currentEdge) {
            finished = false
            break
          }
          if (pairOfEdgesToPolygonPointsDict[currentEdge + nextEdge]) finished = true
          counter++
          j++
        }
        if (finished) stepPairs.push([currentEdge, nextEdge])
      }
    }
  }
  return stepPairs
}

function getOuterCornerPolygonFromCollapsedGraphComponent(
  graphComponent,
  flatPairOfEdgesToPolygonPointsDict,
  edgePolygonDict,
  collapsedEdgesDict,
  id,
) {
  const setOfSteps = getGraphTraversalSteps(graphComponent)
  const { outerStepChain } = getOuterAndInnerStepChains(setOfSteps, graphComponent)
  outerStepChain.reverse()

  const stepPairs = findTrueSteps(outerStepChain, collapsedEdgesDict, flatPairOfEdgesToPolygonPointsDict)

  const polygon = []
  stepPairs.forEach((pair) => {
    const [edge1, edge2] = pair
    const points = getTurnPointsBetweenEdges(flatPairOfEdgesToPolygonPointsDict, edge1, edge2, edgePolygonDict)
    polygon.push(...points)
  })
  return { polygon, id }
}

/**
 * Splits a polygon into two polygons by a line segment
 * @param {Polygon} outerPolygon
 * @param {Polygon} innerPolygon
 * @returns {Polygon}
 */
export function splitDonut(outerPolygon, innerPolygon) {
  const innerStartIndex = 2
  const innerSplitPoint = innerPolygon[innerStartIndex]
  const distances = outerPolygon.map((p) => pointPointDistance(p, innerSplitPoint))
  const outerStartIndex = argMin(distances)
  const n = outerPolygon.length
  const m = innerPolygon.length
  return [
    ...outerPolygon.map((_, i) => outerPolygon[mod(i + outerStartIndex, n)]),
    outerPolygon[outerStartIndex],
    ...innerPolygon.map((_, i) => innerPolygon[mod(i + innerStartIndex, m)]),
    innerPolygon[innerStartIndex],
  ]
}

function graphComponentToCornerPolygon(
  graphComponent,
  flatPairOfEdgesToPolygonPointsDict,
  edgePolygonDict,
  collapsedEdges,
  id,
  overlapLoops,
) {
  const cornerPolygon = getOuterCornerPolygonFromCollapsedGraphComponent(
    graphComponent,
    flatPairOfEdgesToPolygonPointsDict,
    edgePolygonDict,
    collapsedEdges,
    id,
  )

  const overlapLoop = overlapLoops.find((loop) => pointInPolygon(loop.centroid, cornerPolygon.polygon, false))
  if (!overlapLoop) return cornerPolygon
  const splittedPolygon = splitDonut(cornerPolygon.polygon, overlapLoop.polygon)

  return { polygon: splittedPolygon, id }
}

function getMultiVertexCornerPolygons(
  edgePolygonDict,
  flatPairOfEdgesToPolygonPointsDict,
  baseGraph,
  overlapLoopPolygonWithEdgeIds,
) {
  const vertex2NeighbourMap = getVertex2EdgeMap(baseGraph)

  const collapsedEdgesList = Object.values(baseGraph.edges).filter((edge) => !edgePolygonDict[edge.id])
  const collapsedEdges = collapsedEdgesList.reduce((acc, edge) => {
    acc[edge.id] = edge
    return acc
  }, {})
  const newGraph = { edges: collapsedEdges, vertices: baseGraph.vertices }
  const collapsedGraphComponents = findConnectedEdges(newGraph)

  const extendedComponentsWithIds = collapsedGraphComponents.map((graphComponent) => {
    const id = Object.keys(graphComponent.vertices)[0]

    Object.keys(graphComponent.vertices).forEach((vertexId) => {
      const neighbours = vertex2NeighbourMap[vertexId]
      neighbours.forEach((nbh) => {
        if (!collapsedEdges[nbh.edgeId]) {
          const nbhVertex = baseGraph.vertices[nbh.neighbourVertexId]
          const nbhEdge = baseGraph.edges[nbh.edgeId]

          //assign new IDs to the neighbouring components,
          //want to consider each of them in isolation when traversing graph for corner
          const newVertexId = uuidv4()
          const newEdgeId = `${nbh.edgeId}#${uuidv4()}`

          graphComponent.vertices[newVertexId] = { ...nbhVertex, id: newVertexId }
          if (nbhEdge.start === vertexId) {
            graphComponent.edges[newEdgeId] = { ...nbhEdge, end: newVertexId, id: newEdgeId }
          } else {
            graphComponent.edges[newEdgeId] = { ...nbhEdge, start: newVertexId, id: newEdgeId }
          }
        }
      })
    })
    return { graphComponent, id }
  })

  const overlapLoops = overlapLoopPolygonWithEdgeIds.map((p) => {
    const polygon = p.polygonPointsWithIDs.map((p) => p.point)
    const centroid = closedPolygonCentroid(polygon)
    return { polygon, centroid }
  })
  return extendedComponentsWithIds.map(({ graphComponent, id }) => {
    return graphComponentToCornerPolygon(
      graphComponent,
      flatPairOfEdgesToPolygonPointsDict,
      edgePolygonDict,
      collapsedEdges,
      id,
      overlapLoops,
    )
  })
}

function getTurnPointsBetweenEdges(pairOfEdgesToPolygonPointsDict, edgeID1, edgeID2, edgePolygonDict) {
  if (edgeID1 === edgeID2) {
    //TODO: figure out criteria
    //TODO we think this case only occurs in collapsed corners and explains a few bugs
    return []
  }

  if (!pairOfEdgesToPolygonPointsDict[edgeID1 + edgeID2]) {
    console.warn("tried to access non existing turn points")
    //TODO need to understand why/how this happens
    return []
  }

  const turnPoints = pairOfEdgesToPolygonPointsDict[edgeID1 + edgeID2]
  const res = turnPoints.map((p) => p.point)

  const rectDict1 = edgePolygonDict[edgeID1]

  if (rectDict1) {
    const first = turnPoints[0]
    const firstIndex = getIndexHelper(rectDict1, first)
    if (firstIndex !== null) {
      const pointCandidate = rectDict1.polygon[firstIndex]
      res.unshift(pointCandidate)
    }
  }
  const rectDict2 = edgePolygonDict[edgeID2]
  if (rectDict2) {
    const last = turnPoints[turnPoints.length - 1]
    const lastIndex = getIndexHelper(rectDict2, last)
    if (lastIndex !== null) {
      const pointCandidate = rectDict2.polygon[lastIndex]
      res.push(pointCandidate)
    }
  }

  return res
}

function vertexHasCollapsedEdges(neighbours, edgePolygonDict) {
  return neighbours.some((nbh) => !edgePolygonDict[nbh.edgeId])
}

export const getCornerPolygons = (
  pairOfEdgesToPolygonPointsIDs,
  baseGraph,
  edgePolygonDict,
  overlapLoopPolygonWithEdgeIds,
) => {
  const vertex2EdgeMap = getVertex2EdgeMap(baseGraph)
  const singleVertexPolygons = Object.keys(baseGraph.vertices)
    .map((vertexId) => {
      const neighbours = vertex2EdgeMap[vertexId]
      if (neighbours.length === 1) return null
      if (vertexHasCollapsedEdges(neighbours, edgePolygonDict)) return null
      const sortedNeighbours = getSortedNeighbours(neighbours, vertexId, baseGraph)
      const polygon = sortedNeighbours.flatMap((nbh1, i, l) => {
        const nbh2 = l[mod(i + 1, l.length)]
        const edgeID1 = nbh1.edgeId
        const edgeID2 = nbh2.edgeId
        return getTurnPointsBetweenEdges(pairOfEdgesToPolygonPointsIDs, edgeID1, edgeID2, edgePolygonDict)
      })
      return { polygon, id: vertexId }
    })
    .filter((_) => _)
  const multiVertexPolygons = getMultiVertexCornerPolygons(
    edgePolygonDict,
    pairOfEdgesToPolygonPointsIDs,
    baseGraph,
    overlapLoopPolygonWithEdgeIds,
  )
  return singleVertexPolygons.concat(multiVertexPolygons)
}

export const getOuterAndInnerStepChains = (setOfSteps, graph) => {
  let outerKey, innerKeys
  const stuff = checkWindingOfSteps(setOfSteps, graph)
  if (stuff.length === 1) {
    outerKey = stuff[0].key
    innerKeys = []
  } else {
    outerKey = stuff.find((s) => !s.winding).key
    innerKeys = stuff.filter((s) => s.winding).map((s) => s.key)
  }
  return {
    outerStepChain: setOfSteps[outerKey],
    innerStepChains: innerKeys.map((key) => setOfSteps[key]),
  }
}

export function getOuterPolygonFromOffsetGraph(_offsetGraph) {
  const offsetGraph = deepCopy(_offsetGraph)
  const graphIntersected = getGraphIntersectedWithSelf(offsetGraph)
  const polygonsWithEdgeIDs = graphToPolygonsWithOriginEdgesMapping(
    graphIntersected,
    Object.values(graphIntersected.edges),
    false,
  )
  return polygonsWithEdgeIDs.find((p) => isClockwise(p.polygon)).polygon.reverse()
}

export function getInnerPolygonFromOffsetGraphIfOnlyOneExists(offsetGraph) {
  const polygons = getInnerPolygonsFromOffsetGraph(offsetGraph)
  if (polygons.length === 1) return polygons
  return []
}

export function getInnerPolygonsFromOffsetGraph(offsetGraph) {
  const graphIntersected = getGraphIntersectedWithSelf(offsetGraph)

  const polygonsWithEdgeIDs = getOrientedPolygonsWithEdgeIDsFromDirectedGraph(
    graphIntersected.vertices,
    graphIntersected.edges,
    false,
  )
  return polygonsWithEdgeIDs.map((polygonWithEdgeId) => polygonWithEdgeId.polygon)
}

export const getOuterAndInnerGraphs = (graphs) => {
  const intersectedGraphs = graphs.map((g) => {
    const graphIntersected = getGraphIntersectedWithSelf(g)
    return graphIntersected
  })
  const polygonSet = intersectedGraphs.map((g, i) => {
    return {
      polygons: graphToPolygonsWithOriginEdgesMapping(g, Object.values(g.edges), false)
        .map((polygonWithId) => {
          return {
            ...polygonWithId,
            area: polygonArea(polygonWithId.polygon),
          }
        })
        .sort((a, b) => b.area - a.area),
      index: i,
    }
  })

  const indexOfLargest = polygonSet.sort((a, b) => b.polygons[0].area - a.polygons[0].area)[0].index

  const outerGraph = {
    graph: intersectedGraphs[indexOfLargest],
    polygonWithEdgeIds: polygonSet.find((p) => p.index === indexOfLargest).polygons.find((p) => isClockwise(p.polygon)),
  }

  const innerGraphs = polygonSet
    .filter((g) => g.index !== indexOfLargest)
    .map((e) => {
      return {
        graph: intersectedGraphs[e.index],
        polygonWithEdgeIds: e.polygons[1],
      }
    })
  return { outerGraph, innerGraphs }
}

function getEdgeLength(edge, vertices) {
  const p1 = [vertices[edge.start].x, vertices[edge.start].y]
  const p2 = [vertices[edge.end].x, vertices[edge.end].y]
  return pointPointDistance(p1, p2)
}

export function pruneDanglingShortEdges(graph) {
  const newEdges = {}
  const newVertices = {}
  const vertexNeighbourMap = getVertex2EdgeMap(graph)
  Object.values(graph.edges).forEach((edge) => {
    const startNeighbours = vertexNeighbourMap[edge.start]
    const endNeighbours = vertexNeighbourMap[edge.end]
    if (
      (startNeighbours.length === 1 && endNeighbours.length !== 1) ||
      (endNeighbours.length === 1 && startNeighbours.length !== 1)
    ) {
      const edgeLength = getEdgeLength(edge, graph.vertices)
      const neighbourEdgeWidths = [...startNeighbours, ...endNeighbours].map((nbh) => graph.edges[nbh.edgeId].width)
      const maxWidth = Math.max(...neighbourEdgeWidths)

      if (edgeLength > maxWidth * 0.75) {
        newEdges[edge.id] = edge
        newVertices[edge.start] = graph.vertices[edge.start]
        newVertices[edge.end] = graph.vertices[edge.end]
      }
    } else {
      newEdges[edge.id] = edge
      newVertices[edge.start] = graph.vertices[edge.start]
      newVertices[edge.end] = graph.vertices[edge.end]
    }
  })
  return { vertices: newVertices, edges: newEdges }
}
