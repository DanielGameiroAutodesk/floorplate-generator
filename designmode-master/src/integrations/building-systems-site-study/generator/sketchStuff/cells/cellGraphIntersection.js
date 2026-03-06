import { mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { v4 as uuidv4 } from "uuid"
import {
  pointInPolygon,
  pointOnLineSegment,
  pointPointDistance,
  pointsAlmostEqual,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { getEdgePoints } from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/graphHelpers.js"
import {
  customIntersection,
  getGraphIntersectedWithSelf,
  removeRedundantVerticesAndEdges,
  snapGraphToBuildingLimit,
} from "./graphIntersectionHelpers.js"

const PRECISION = 0.01
const SNAP_DIST = 0.1

function averagePoint(p1, p2) {
  const x = (p1[0] + p2[0]) * 0.5
  const y = (p1[1] + p2[1]) * 0.5
  return [x, y]
}

function intersectEdgeWithoutEndPointsWithBuildingLimit(
  edgeStartPoint,
  edgeEndPoint,
  buildingLimitStartPoint,
  buildingLimitEndPoint,
) {
  const intersectionResult = customIntersection(
    edgeStartPoint,
    edgeEndPoint,
    buildingLimitStartPoint,
    buildingLimitEndPoint,
  )
  if (!intersectionResult) {
    return null
  }
  const { t, u, intersectionPoint } = intersectionResult
  const tolerance = 0.00000001
  if (t > tolerance && u >= 0 && t < 1 - tolerance && u <= 1) {
    return intersectionPoint
  }
  return null
}

function constructNewVerticesEdges(startIndex, intersectionVertices, width) {
  let foundVertices = {}
  let foundEdges = {}

  const uniqueVertices = intersectionVertices.map((v, i) => {
    const p = [v.x, v.y]
    for (let j = 0; j < i; j++) {
      const vPrev = intersectionVertices[j]
      const pPrev = [vPrev.x, vPrev.y]
      if (pointsAlmostEqual(p, pPrev)) return vPrev
    }
    return v
  })

  for (let i = startIndex; i < uniqueVertices.length - 1; i++) {
    if (i % 2 === startIndex) {
      const startId = uniqueVertices[i].id
      const endId = uniqueVertices[i + 1].id
      if (startId === endId) continue
      const foundEdge = { id: uuidv4(), start: startId, end: endId, width: width }
      foundEdges[foundEdge.id] = foundEdge
      foundVertices[uniqueVertices[i].id] = uniqueVertices[i]
      foundVertices[uniqueVertices[i + 1].id] = uniqueVertices[i + 1]
    }
  }
  return { vertices: foundVertices, edges: foundEdges }
}

function alternatingLineLogic(intersectionPoints, buildingLimit, startVertex) {
  const p1 = [startVertex.x, startVertex.y]
  const p2 = [intersectionPoints[1].x, intersectionPoints[1].y]
  let startIndex = 0

  if (!pointInPolygon(averagePoint(p1, p2), buildingLimit, true)) startIndex = 1

  return startIndex
}

function getIntersectionsForOneBuildingLimit(buildingLimit, edgeStartPoint, edgeEndPoint, snapDist = SNAP_DIST) {
  let intersectionVertices = []
  const m = buildingLimit.length
  for (let j = 0; j < m; j++) {
    const buildingLimitStartPoint = buildingLimit[j]
    const buildingLimitEndPoint = buildingLimit[mod(j + 1, m)]
    const intersectionPointCandidate = intersectEdgeWithoutEndPointsWithBuildingLimit(
      edgeStartPoint,
      edgeEndPoint,
      buildingLimitStartPoint,
      buildingLimitEndPoint,
    )
    if (!intersectionPointCandidate) {
      continue
    }

    let intersectionPoint = intersectionPointCandidate
    const distFromStart = pointPointDistance(intersectionPoint, buildingLimitStartPoint)
    const distFromEnd = pointPointDistance(intersectionPoint, buildingLimitEndPoint)
    if (distFromStart < distFromEnd && distFromStart < snapDist) {
      intersectionPoint = buildingLimitStartPoint
    } else if (distFromEnd < snapDist) {
      intersectionPoint = buildingLimitEndPoint
    }
    intersectionVertices.push({ id: uuidv4(), x: intersectionPoint[0], y: intersectionPoint[1] })
  }
  return intersectionVertices
}

function getAllIntersectionsIncludingEdgeEndPoints(buildingLimit, startVertex, endVertex) {
  const edgeStartPoint = [startVertex.x, startVertex.y]
  const edgeEndPoint = [endVertex.x, endVertex.y]
  const intersectionVertices = getIntersectionsForOneBuildingLimit(buildingLimit, edgeStartPoint, edgeEndPoint)
  intersectionVertices.sort(
    (a, b) => pointPointDistance([a.x, a.y], edgeStartPoint) - pointPointDistance([b.x, b.y], edgeStartPoint),
  )
  return [startVertex, ...intersectionVertices, endVertex]
}

export function updateGraphWithReplacingVertexID(graph, edgeValues, oldVertexID, newVertexID) {
  edgeValues.forEach((e) => {
    if (e.start === oldVertexID) {
      graph.edges[e.id].start = newVertexID
    }
    if (e.end === oldVertexID) {
      graph.edges[e.id].end = newVertexID
    }
  })
  delete graph.vertices[oldVertexID]
  return graph
}

function findIntersectionsForOneEdge(cellGraph, movingEdgeId, buildingLimit) {
  const edge = cellGraph.edges[movingEdgeId]
  const startVertex = cellGraph.vertices[edge.start]
  const endVertex = cellGraph.vertices[edge.end]
  const intersectionPoints = getAllIntersectionsIncludingEdgeEndPoints(buildingLimit, startVertex, endVertex)
  const startIndex = alternatingLineLogic(intersectionPoints, buildingLimit, startVertex)
  const foundGraph = constructNewVerticesEdges(startIndex, intersectionPoints, edge.width)
  return foundGraph
}

function removeEdgeIfAlongBuildingLimits(graph, edgeId, buildingLimit, precision) {
  const edge = graph.edges[edgeId]
  const [p1, p2] = getEdgePoints(edge, graph.vertices)
  const m = buildingLimit.length
  for (let j = 0; j < m; j++) {
    const p3 = buildingLimit[j]
    const p4 = buildingLimit[mod(j + 1, m)]
    if (pointOnLineSegment(p1, p3, p4, precision) && pointOnLineSegment(p2, p3, p4, precision)) {
      delete graph.edges[edgeId]
      return graph
    }
  }
  return graph
}

function removeEdgesAlongBuildingLimit(graph, buildingLimit, precision) {
  let fixedGraph = graph
  Object.keys(graph.edges).forEach((edgeID) => {
    fixedGraph = removeEdgeIfAlongBuildingLimits(fixedGraph, edgeID, buildingLimit, precision)
  })
  return fixedGraph
}

function cutGraphToOneBuildingLimit(graph, buildingLimit, precision) {
  const vertices = {}
  const edges = {}
  Object.values(graph.edges).forEach((edge) => {
    const subGraph = findIntersectionsForOneEdge(graph, edge.id, buildingLimit)
    Object.values(subGraph.vertices).forEach((vertex) => (vertices[vertex.id] = vertex))
    Object.values(subGraph.edges).forEach((edge) => (edges[edge.id] = edge))
  })
  return removeEdgesAlongBuildingLimit({ vertices, edges }, buildingLimit, precision)
}

export function getGraphCutToBuildingLimits(graph, buildingLimits, precision = PRECISION) {
  const vertices = {}
  const edges = {}

  buildingLimits.forEach((buildingLimit) => {
    const graphCutToOneBuildingLimit = cutGraphToOneBuildingLimit(graph, buildingLimit, precision)
    const graphSnappedToOneBuildingLimit = snapGraphToBuildingLimit(
      graphCutToOneBuildingLimit,
      buildingLimit,
      2 * precision,
    )
    Object.values(graphSnappedToOneBuildingLimit.edges).forEach((edge) => (edges[edge.id] = edge))
    Object.values(graphSnappedToOneBuildingLimit.vertices).forEach((vertex) => (vertices[vertex.id] = vertex))
  })

  return removeRedundantVerticesAndEdges({ vertices, edges }, precision)
}

export function getGraphCutToSelfAndBuildingLimits(graph, buildingLimits) {
  const graphCutToSelf = getGraphIntersectedWithSelf(graph)
  return getGraphCutToBuildingLimits(graphCutToSelf, buildingLimits)
}
