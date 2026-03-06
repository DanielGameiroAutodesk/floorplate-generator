import {
  closedPolygonCentroid,
  polygonArea,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { v4 as uuidv4 } from "uuid"
import { buildTotalGraphForPolygonCalc, getSubGraphWithinBuildingLimit } from "./splitBuildingLimit.js"
import { bufferPolygonWithVaryingOffsets } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/polygonBuffer.js"
import { graphToPolygons } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/polygonsFromGraph.js"

export function sumOfCoordinates(polygon) {
  return polygon.reduce((acc, cur) => acc + cur[0] + cur[1], 0) / polygon.length
}

export function getAreaDifference(cells, buildingLimits) {
  const totalBuildingLimitArea = buildingLimits.reduce((acc, cum) => {
    acc += polygonArea(cum)
    return acc
  }, 0)
  const totalCellArea = cells.reduce((acc, cum) => {
    acc += polygonArea(cum)
    return acc
  }, 0)

  return Math.abs(totalCellArea - totalBuildingLimitArea)
}

export function getCellId(polygon) {
  const centroid = closedPolygonCentroid(polygon)
  const roundedCentroid = centroid.map((coord) => coord.toFixed(1))
  return JSON.stringify(roundedCentroid)
}

export function removeOuterPolygon(polygons) {
  polygons.sort((p1, p2) => polygonArea(p2.polygon) - polygonArea(p1.polygon))
  if (Math.abs(polygonArea(polygons[0].polygon) - polygonArea(polygons[1].polygon)) < 1) {
    if (polygons[0].polygon.length > polygons[1].polygon.length) {
      return [polygons[0], ...polygons.slice(2)]
    }
  }
  return polygons.slice(1)
}

export function getCellsWithPolygons(graph, buildingLimits, includeBufferedPolygons = true) {
  const edgeValues = Object.values(graph.edges)
  const cellsWithPolygons = []

  buildingLimits.forEach((buildingLimit) => {
    const graphWithinBuildingLimit = getSubGraphWithinBuildingLimit(graph, buildingLimit)
    const totalGraph = buildTotalGraphForPolygonCalc(graphWithinBuildingLimit, buildingLimit)
    const polygonsWithBelongingEdgeIDs = graphToPolygons(totalGraph, edgeValues)
    if (polygonsWithBelongingEdgeIDs.length) {
      const innerPolygons = removeOuterPolygon(polygonsWithBelongingEdgeIDs)
      innerPolygons.forEach((innerPolygon) => {
        innerPolygon.id = getCellId(innerPolygon.polygon)
        if (includeBufferedPolygons) {
          innerPolygon.buffered_polygons = getBufferedPolygonForCell({ ...innerPolygon }, graphWithinBuildingLimit)
        }
      })
      cellsWithPolygons.push(...innerPolygons)
    }
  })
  return cellsWithPolygons
}

export function edgeIDsToBufferWidth(edgeIDs, edges) {
  const buffers = []
  for (let i = 0; i < edgeIDs.length; i++) {
    if (edgeIDs[i]) buffers.push(edges[edgeIDs[i]].width / 2)
    else buffers.push(0)
  }
  return buffers
}

export function getBufferedPolygonForCell(cell, graph) {
  const bufferedPolygons = bufferPolygonWithVaryingOffsets(
    cell.polygon,
    edgeIDsToBufferWidth(cell.edgeIDs, graph.edges),
  )
  return bufferedPolygons.map((bp) => ({
    id: uuidv4(),
    parent: cell.id,
    polygon: bp,
  }))
}
