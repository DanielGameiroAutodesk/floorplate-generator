import { getCellsWithPolygons } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellHelpers.js"
import {
  getBbox,
  polygonArea,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import {
  affineMultiply,
  createRotateAffine,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/affineHelpers.js"
import { polygonToGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/graphHelpers.js"
import {
  getEdgeLength,
  getVertexEdgeMap,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { getGraphToBuildingLimitMap } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/splitBuildingLimit.js"
import { getGraphCutToBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection.js"
import { generateCompleteCellGrid } from "./cellGridGenerator.js"

const SMALL_AREA_THESHOLD = 3000

function drawAngle(buildingLimit) {
  const candidates = buildingLimit
    .map((p, i) => {
      const p2 = buildingLimit[(i + 1) % buildingLimit.length]
      const v = [p2[0] - p[0], p2[1] - p[1]]
      const length = Math.sqrt(Math.pow(v[0], 2), Math.pow(v[1], 2))
      if (Math.abs(length) < 1e-8) {
        return { angle: 0, length }
      }
      const vNorm = [v[0] / length, v[1] / length]
      if (Math.abs(v[1]) < 1e-8) {
        return { angle: 0, length }
      }
      return { angle: Math.atan(vNorm[0] / vNorm[1]), length }
    })
    .sort((a, b) => b.length - a.length)
  let cumSum = 0
  candidates.forEach((c) => {
    cumSum += c.length
    c.cumSum = cumSum
  })
  const draw = Math.random() * cumSum
  const winner = candidates.find((c) => c.cumSum >= draw)
  return winner.angle
}

function cleanGrid(cellGraph, buildingLimit) {
  const vertices = { ...cellGraph.vertices }
  const edges = { ...cellGraph.edges }
  const cellsWithPolygons = getCellsWithPolygons(cellGraph, [buildingLimit], false)
  const smallCells = cellsWithPolygons.filter((cell) => polygonArea(cell.polygon) < SMALL_AREA_THESHOLD)
  const edgeIDsToDelete = []
  smallCells.forEach((cell) => {
    const sortedIds = cell.edgeIDs
      .filter((e) => e)
      .map((edgeID) => ({ edgeID, length: getEdgeLength(edges[edgeID], vertices) }))
      .sort((a, b) => b.length - a.length)

    if (sortedIds.length > 0) edgeIDsToDelete.push(sortedIds[0].edgeID)
  })

  edgeIDsToDelete.forEach((edgeID) => delete edges[edgeID])
  const vertexEdgeMap = getVertexEdgeMap(vertices, edges)

  const verticesAtBuildingLimit = []
  const buildingLimitMapping = getGraphToBuildingLimitMap(
    { vertices, edges },
    polygonToGraph(buildingLimit),
    buildingLimit,
  )
  Object.values(buildingLimitMapping.splittedEdges).forEach((edge) => {
    if (vertices[edge.start]) verticesAtBuildingLimit.push(edge.start)
    if (vertices[edge.end]) verticesAtBuildingLimit.push(edge.end)
  })
  Object.values(buildingLimitMapping.vertexMap).forEach((vertex) => verticesAtBuildingLimit.push(vertex))

  const freeVertices = Object.keys(vertices).filter(
    (id) => vertexEdgeMap[id].length === 1 && !verticesAtBuildingLimit.includes(id),
  )
  freeVertices.forEach((id) => delete vertices[id])
  Object.values(edges).forEach((edge) => {
    if (!vertices[edge.start] || !vertices[edge.end]) {
      delete edges[edge.id]
    }
  })

  const updatedVertexEdgeMap = getVertexEdgeMap(vertices, edges)
  Object.keys(updatedVertexEdgeMap)
    .filter((vertexID) => updatedVertexEdgeMap[vertexID].length === 0)
    .forEach((ID) => {
      delete vertices[ID]
    })

  return { vertices, edges }
}

export function generateGridGraph(buildingLimits, streetWidth) {
  const cellGraphs = buildingLimits.map((bl) => {
    const rotateAngle = drawAngle(bl)
    const bbOrg = getBbox([bl])
    const pivot = [(bbOrg.xMin + bbOrg.xMax) / 2, (bbOrg.yMin + bbOrg.yMax) / 2]
    const affine = createRotateAffine(rotateAngle, pivot)
    const { xMin, xMax, yMin, yMax } = getBbox(
      [bl].map((bl) => bl.map((p) => affineMultiply(p, affine))),
      0.5,
    )
    const width = xMax - xMin
    const height = yMax - yMin
    const dx = (width + 0.1) / Math.max(Math.round(width / 80), 1)
    const dy = (height + 0.1) / Math.max(Math.round(height / 80), 1)
    const uncutGraph = generateCompleteCellGrid({
      originPoint: [xMin, yMin],
      boxWidth: width,
      boxHeight: height,
      width: streetWidth,
      buildingLimits,
      rotateAngle,
      pivotPoint: pivot,
      shiftX: 0,
      shiftY: 0,
      dx,
      dy,
      clipWithGraphFormulation: true,
    })
    const graphCutToBuildingLimits = getGraphCutToBuildingLimits(uncutGraph, [bl])
    const cleanedGraph = cleanGrid(graphCutToBuildingLimits, bl)
    return cleanedGraph
  })
  return cellGraphs.reduce(
    (acc, g) => ({ vertices: { ...acc.vertices, ...g.vertices }, edges: { ...acc.edges, ...g.edges } }),
    { vertices: {}, edges: {} },
  )
}
