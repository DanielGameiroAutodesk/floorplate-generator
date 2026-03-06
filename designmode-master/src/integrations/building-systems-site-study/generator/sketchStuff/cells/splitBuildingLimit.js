import { v4 as uuidv4 } from "uuid"
import { customIntersection } from "./graphIntersectionHelpers.js"
import {
  getCrossProduct,
  getMidPoint,
  getVectorFromPointToPoint,
  pointInPolygon,
  pointPointDistance,
  pointToLineSegmentDistance,
  uniqifyList,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { deepCopy } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers.js"
import {
  getEdgePoints,
  polygonToGraph,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/graphHelpers.js"

const INTERSECTION_DISTANCE = 0.0001
const SAME_VERTEX_DISTANCE = 0.01

function getEmptyBuildingLimitMap(buildingLimitsGraph) {
  const edgeMap = Object.keys(buildingLimitsGraph.edges).reduce((acc, cum) => {
    acc[cum] = [cum]
    return acc
  }, {})
  return { edgeMap: edgeMap, splittedEdges: {}, vertexMap: {} }
}

function mapEdgeToBuildingLimit(
  buildingLimit,
  buildingLimitsGraph,
  cellGraph,
  buildingLimitMapping,
  edgeId,
  startVertexIsIncluded,
  endVertexIsIncluded,
  allVertices,
) {
  const { edgeMap, splittedEdges, vertexMap } = buildingLimitMapping
  const buildingLimitEdgeIds = Object.keys(buildingLimitsGraph.edges)
  const cellEdge = cellGraph.edges[edgeId]
  const cellEdgePoints = getEdgePoints(cellEdge, cellGraph.vertices)
  const cellEdgeLength = pointPointDistance(cellEdgePoints[0], cellEdgePoints[1])
  const tTolerance = INTERSECTION_DISTANCE / cellEdgeLength
  let foundStartVertex = startVertexIsIncluded
  let foundEndVertex = endVertexIsIncluded
  for (let j = 0; j < buildingLimitEdgeIds.length; j++) {
    const splittedEdgeIds = edgeMap[buildingLimitEdgeIds[j]]
    for (let k = 0; k < splittedEdgeIds.length; k++) {
      const subEdge = buildingLimitsGraph.edges[splittedEdgeIds[k]]
        ? buildingLimitsGraph.edges[splittedEdgeIds[k]]
        : splittedEdges[splittedEdgeIds[k]]
      const subEdgePoints = getEdgePoints(subEdge, allVertices)
      const intersectionRes = customIntersection(
        cellEdgePoints[0],
        cellEdgePoints[1],
        subEdgePoints[0],
        subEdgePoints[1],
      )
      if (intersectionRes) {
        if (!validOrientationBetweenEdges(subEdgePoints, cellEdgePoints)) continue
        const { t, u, intersectionPoint } = intersectionRes
        if (foundStartVertex && -tTolerance <= t && t <= tTolerance) continue
        if (foundEndVertex && 1 - tTolerance <= t && t <= 1 + tTolerance) continue
        if (t >= -tTolerance && t <= 1 + tTolerance && u >= 0 && u <= 1) {
          const intersectionVertexId = t < 0.5 ? cellEdge.start : cellEdge.end
          foundStartVertex = t < 0.5 || foundStartVertex
          foundEndVertex = t > 0.5 || foundEndVertex

          const distFromStart = pointPointDistance(intersectionPoint, subEdgePoints[0])
          const distFromEnd = pointPointDistance(intersectionPoint, subEdgePoints[1])
          if (distFromStart < distFromEnd && distFromStart < SAME_VERTEX_DISTANCE) {
            vertexMap[subEdge.start] = intersectionVertexId
          } else if (distFromEnd < SAME_VERTEX_DISTANCE) {
            vertexMap[subEdge.end] = intersectionVertexId
          } else {
            const splitEdge1 = { id: uuidv4(), start: subEdge.start, end: intersectionVertexId }
            const splitEdge2 = { id: uuidv4(), start: intersectionVertexId, end: subEdge.end }
            splittedEdges[splitEdge1.id] = splitEdge1
            splittedEdges[splitEdge2.id] = splitEdge2
            edgeMap[buildingLimitEdgeIds[j]] = [
              ...splittedEdgeIds.slice(0, k),
              splitEdge1.id,
              splitEdge2.id,
              ...splittedEdgeIds.slice(k + 1),
            ]
            delete splittedEdges[subEdge.id]
          }
          if (foundEndVertex && foundStartVertex) {
            return { edgeMap, splittedEdges, vertexMap }
          }
        }
      }
    }
  }
}

function validOrientationBetweenEdges(blEdgePoints, cellEdgePoints) {
  const sortedCellEdgePoints = deepCopy(cellEdgePoints).sort(
    (a, b) =>
      pointToLineSegmentDistance(a, blEdgePoints[0], blEdgePoints[1]) -
      pointToLineSegmentDistance(b, blEdgePoints[0], blEdgePoints[1]),
  )
  const cellEdgeVec = getVectorFromPointToPoint(...sortedCellEdgePoints)
  const subEdgeVec = getVectorFromPointToPoint(...blEdgePoints)
  return getCrossProduct(subEdgeVec, cellEdgeVec) >= 0
}

export function getSubGraphWithinBuildingLimit(graph, buildingLimit) {
  const filteredEdges = {}
  const filteredVertices = {}

  Object.values(graph.edges).forEach((edge) => {
    const edgePoints = [
      [graph.vertices[edge.start].x, graph.vertices[edge.start].y],
      [graph.vertices[edge.end].x, graph.vertices[edge.end].y],
    ]
    if (pointInPolygon(edgePoints[0], buildingLimit, true) && pointInPolygon(edgePoints[1], buildingLimit, true)) {
      filteredEdges[edge.id] = edge
      if (!filteredVertices[edge.start]) filteredVertices[edge.start] = graph.vertices[edge.start]
      if (!filteredVertices[edge.end]) filteredVertices[edge.end] = graph.vertices[edge.end]
    }
  })
  return { vertices: filteredVertices, edges: filteredEdges }
}

export function buildTotalGraphForPolygonCalc(cellGraph, buildingLimit) {
  const buildingLimitGraph = polygonToGraph(buildingLimit)
  const buildingLimitMapping = getGraphToBuildingLimitMap(cellGraph, buildingLimitGraph, buildingLimit)
  return buildGraphForPolygonCalculationOneBL(buildingLimit, buildingLimitGraph, cellGraph, buildingLimitMapping)
}

function buildGraphForPolygonCalculationOneBL(
  buildingLimitPolygon,
  buildingLimitGraph,
  cellGraph,
  buildingLimitMapping,
) {
  const vertices = { ...buildingLimitGraph.vertices }
  const edges = {}
  const { vertexMap, splittedEdges } = buildingLimitMapping
  const candidateEdgesAlongBL = { ...buildingLimitGraph.edges, ...splittedEdges }
  const buildingLimitEdgeIDs = Object.keys(buildingLimitGraph.edges)
    .map((edgeID) => buildingLimitMapping.edgeMap[edgeID])
    .flat()
  buildingLimitEdgeIDs.forEach((id) => {
    edges[id] = candidateEdgesAlongBL[id]
  })
  const splittedEdgesValues = Object.values(splittedEdges)
  const cellVertexIDsAlongBL = uniqifyList(
    splittedEdgesValues
      .map((edge) => [edge.start, edge.end])
      .flat()
      .filter((id) => cellGraph.vertices[id]),
  )
  Object.keys(vertexMap).forEach((id) => {
    cellVertexIDsAlongBL.push(vertexMap[id])
  })

  const cellVertexIDsInsideBL = Object.keys(cellGraph.vertices).filter((id) => {
    const point = [cellGraph.vertices[id].x, cellGraph.vertices[id].y]
    return pointInPolygon(point, buildingLimitPolygon)
  })

  ;[...cellVertexIDsAlongBL, ...cellVertexIDsInsideBL].forEach((id) => (vertices[id] = cellGraph.vertices[id]))

  const cellEdgeIDsInsideBL = Object.keys(cellGraph.edges).filter((edgeID) => {
    const edge = cellGraph.edges[edgeID]
    if (cellVertexIDsAlongBL.includes(edge.start) && cellVertexIDsAlongBL.includes(edge.end)) {
      const midPoint = getMidPoint(...getEdgePoints(edge, cellGraph.vertices))
      return pointInPolygon(midPoint, buildingLimitPolygon)
    }
    return vertices[edge.start] && vertices[edge.end]
  })

  cellEdgeIDsInsideBL.forEach((id) => {
    edges[id] = cellGraph.edges[id]
  })

  const edgeIDs = Object.keys(edges)
  const newEdges = deepCopy(edges)

  edgeIDs.forEach((ID) => {
    newEdges[ID].start = vertexMap[newEdges[ID].start] ? vertexMap[newEdges[ID].start] : newEdges[ID].start
    newEdges[ID].end = vertexMap[newEdges[ID].end] ? vertexMap[newEdges[ID].end] : newEdges[ID].end
  })

  return { vertices, edges: newEdges }
}

function updateGraphToBuildingLimitMap(graph, buildingLimitGraph, buildingLimitMapping, buildingLimit) {
  let { edgeMap, splittedEdges, vertexMap } = buildingLimitMapping
  const includedVerticesMap = {}
  const allVertices = { ...graph.vertices, ...buildingLimitGraph.vertices }

  const edgeIds = Object.keys(graph.edges)
  for (let i = 0; i < edgeIds.length; i++) {
    const edgeId = edgeIds[i]
    const edge = graph.edges[edgeId]
    const startVertexIsIncluded = includedVerticesMap[edge.start]
    const endVertexIsIncluded = includedVerticesMap[edge.end]
    if (startVertexIsIncluded && endVertexIsIncluded) continue
    mapEdgeToBuildingLimit(
      buildingLimit,
      buildingLimitGraph,
      graph,
      { edgeMap, splittedEdges, vertexMap },
      edgeId,
      startVertexIsIncluded,
      endVertexIsIncluded,
      allVertices,
    )
    includedVerticesMap[edge.start] = true
    includedVerticesMap[edge.end] = true
  }
  return { edgeMap, splittedEdges, vertexMap }
}

export function getGraphToBuildingLimitMap(graph, buildingLimitGraph, buildingLimit) {
  const graphToBuildingLimitMap = getEmptyBuildingLimitMap(buildingLimitGraph)
  return updateGraphToBuildingLimitMap(graph, buildingLimitGraph, graphToBuildingLimitMap, buildingLimit)
}
