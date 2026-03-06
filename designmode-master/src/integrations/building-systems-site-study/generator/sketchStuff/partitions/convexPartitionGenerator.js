import { getCellsWithPolygons } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellHelpers.js"
import {
  drawEdgeFromPointAndDirection,
  drawEdgeThroughPointAndDirection,
  getClosestPointInPolygon,
  getConvexityScore,
  getShapeScore,
  isPolygonConcave,
  polygonsFromSplit,
  skinnyPolygon2,
} from "./partitionHelpers.js"
import {
  getTValuesFromPoints,
  getTValuesOfSignificantCorners,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/curvature.js"
import {
  gaussSmoothen,
  normalizeArrayMaxNorm,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/gauss.js"
import { getGraphCutToSelfAndBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection.js"
import {
  closedPolygonCentroid,
  closePolygon,
  getAnglesAtPolygonVertices,
  getDominantAngleInPolygon,
  polygonArea,
  removeLastPointInPolygonIfEqualsFirst,
  uniqifyList,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { getGraphIntersectedWithSelf } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/graphIntersectionHelpers.js"
import simplify from "simplify-geometry"

// const simplify = require("simplify-geometry")
const SIGMA = 5
const SIMPLIFICATION = 1
const MAX_ITER = 10
const MIN_SPLIT_AREA = 6000
const MIN_AREA = 1000
const MIN_WIDTH_POLYGON = 40
const THRESHOLD = 0.3
const MAX_DISTANCE = 500
const FILL_AMOUNT = 0.2
const RESOLUTION = 1000

function validSplit(polygon, splittedPolygons) {
  let valid = true
  splittedPolygons.forEach((polygon) => {
    if (skinnyPolygon2(polygon) < MIN_WIDTH_POLYGON) {
      valid = false
    }
    if (polygonArea(polygon) < MIN_AREA) {
      valid = false
    }
  })
  return valid
}

function getConvexPartition(inputPolygons) {
  const polygons = [...inputPolygons]
  let continueSplitting = true
  const cellVertices = {}
  const cellEdges = {}
  const polygonsToSplit = polygons
  let iteration = 0
  while (continueSplitting && iteration < MAX_ITER) {
    const splittedPolygons = []
    const n = polygonsToSplit.length
    for (let i = 0; i < n; i++) {
      const polygon = removeLastPointInPolygonIfEqualsFirst(polygonsToSplit.pop())
      const { graph, splittedPolygons: _splittedPolygons } = getNextSplit(polygon)
      if (_splittedPolygons.length === 0) {
        continue
      }
      if (_splittedPolygons.length < 2) {
        return { vertices: cellVertices, edges: cellEdges }
      }
      Object.values(graph.edges).forEach((edge) => (cellEdges[edge.id] = edge))
      Object.values(graph.vertices).forEach((vertex) => (cellVertices[vertex.id] = vertex))
      splittedPolygons.push(..._splittedPolygons)
    }
    splittedPolygons.forEach((poly) => {
      if (isPolygonConcave(simplify(poly, 3)) && polygonArea(poly) > MIN_SPLIT_AREA) {
        polygonsToSplit.push(poly)
      }
    })
    continueSplitting = polygonsToSplit.length > 0
    iteration++
  }
  return getGraphIntersectedWithSelf({ vertices: cellVertices, edges: cellEdges })
}

export function getConvexRefinedPartition(inputPolygons, splitWidth, splitArea) {
  const cellGraph = getConvexPartition(inputPolygons)
  const polygons = polygonsFromSplit(inputPolygons, cellGraph)
  const cellGraph2 = getRefinedPartition(polygons, splitArea)
  Object.values(cellGraph2.edges).forEach((edge) => (cellGraph.edges[edge.id] = edge))
  Object.values(cellGraph2.vertices).forEach((vertex) => (cellGraph.vertices[vertex.id] = vertex))

  Object.values(cellGraph.edges).forEach((edge) => (edge.width = splitWidth))
  return getGraphCutToSelfAndBuildingLimits(cellGraph, inputPolygons)
}

function getRefinedPartition(inputPolygons, splitArea) {
  const polygonsToSplit = inputPolygons.filter((p) => polygonArea(p) > splitArea)
  let continueSplitting = true
  const cellVertices = {}
  const cellEdges = {}
  let iteration = 0

  while (continueSplitting && iteration < MAX_ITER) {
    const splittedPolygons = []
    const n = polygonsToSplit.length
    for (let i = 0; i < n; i++) {
      const polygon = removeLastPointInPolygonIfEqualsFirst(polygonsToSplit.pop())
      const { graph, splittedPolygons: _splittedPolygons } = getSplitAlongCentroid(polygon)
      if (_splittedPolygons.length === 0) {
        continue
      }
      if (_splittedPolygons.length < 2) {
        return { vertices: cellVertices, edges: cellEdges }
      }
      Object.values(graph.edges).forEach((edge) => (cellEdges[edge.id] = edge))
      Object.values(graph.vertices).forEach((vertex) => (cellVertices[vertex.id] = vertex))
      splittedPolygons.push(..._splittedPolygons)
    }
    splittedPolygons.forEach((poly) => {
      if (polygonArea(poly) > splitArea) {
        polygonsToSplit.push(poly)
      }
    })
    continueSplitting = polygonsToSplit.length > 0
    iteration++
  }
  return getGraphIntersectedWithSelf({ vertices: cellVertices, edges: cellEdges })
}

function getCandidatePoints(simplifiedPolygon) {
  const polygonTValues = getTValuesFromPoints(simplifiedPolygon)
  const concaveCurvature = getPolygonCurvatureForConcaveAngles(simplifiedPolygon, 1)
  const tValuesConcaveCorners = getTValuesOfSignificantCorners(concaveCurvature, THRESHOLD, FILL_AMOUNT)
  const points = uniqifyList(
    tValuesConcaveCorners.map((t) => getClosestPointInPolygon(t, polygonTValues, simplifiedPolygon)),
  )
  return points
}

function getCandidateAngles(simplifiedPolygon) {
  const angle1 = (getDominantAngleInPolygon(simplifiedPolygon, SIGMA) / 180 - 0.5) * Math.PI
  const angle2 = (getDominantAngleInPolygon(simplifiedPolygon, SIGMA) * Math.PI) / 180
  return [angle1, angle2]
}

function getMultipleSplitGraphs(inputPolygon) {
  const polygon = simplify(inputPolygon, SIMPLIFICATION)
  const points = getCandidatePoints(polygon)
  const angles = getCandidateAngles(polygon)
  const graphs = []
  for (const point of points) {
    for (const angle of angles) {
      graphs.push(drawEdgeFromPointAndDirection(inputPolygon, point, angle, MAX_DISTANCE))
    }
  }
  return graphs
}

function getMultipleSplits(inputPolygon) {
  const graphs = getMultipleSplitGraphs(inputPolygon)
  return graphs.map((graph) => graphToSplit(inputPolygon, graph.vertices, graph.edges))
}

function getNextSplit(polygon) {
  const splits = getMultipleSplits(polygon)
  const validSplits = splits.filter((s) => s.valid)
  if (!validSplits.length) return { graph: {}, splittedPolygons: [] }
  validSplits.sort((a, b) => b.convexScore - a.convexScore)
  return validSplits[0]
}

export function getSplitAlongCentroid(polygon) {
  const simplifiedPolygon = simplify(polygon, SIMPLIFICATION)
  const angle = (getDominantAngleInPolygon(simplifiedPolygon, SIGMA) / 180 - 0.5) * Math.PI
  const centroid = closedPolygonCentroid(closePolygon(simplifiedPolygon))
  const graph = drawEdgeThroughPointAndDirection(polygon, centroid, angle, MAX_DISTANCE)
  return graphToSplit(polygon, graph.vertices, graph.edges)
}

function graphToSplit(polygon, vertices, edges) {
  const graph = getGraphCutToSelfAndBuildingLimits({ vertices, edges }, [polygon])
  const splittedPolygons = getCellsWithPolygons(graph, [polygon], false).map((p) => p.polygon)
  const valid = validSplit(polygon, splittedPolygons)
  const convexScore = getConvexityScore(polygon, splittedPolygons)
  const shapeScore = getShapeScore(polygon, splittedPolygons)
  return { graph, splittedPolygons, valid, convexScore, shapeScore }
}

function getPolygonCurvatureForConcaveAngles(polygon, smoothingFactor) {
  const polygonTValues = getTValuesFromPoints(polygon)
  const scaledPolygonTValues = polygonTValues.map((t) => t * RESOLUTION)
  const curvature = Array(RESOLUTION).fill(0)
  const anglesAtVertices = getAnglesAtPolygonVertices(polygon)
  for (let i = 0; i < anglesAtVertices.length; i++) {
    if (anglesAtVertices[i] > 0.1) {
      const index = Math.round(scaledPolygonTValues[i])
      curvature[index] = anglesAtVertices[i]
    }
  }
  const smoothed = gaussSmoothen(curvature, smoothingFactor)
  return normalizeArrayMaxNorm(smoothed)
}
