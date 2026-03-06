import {
  getGraphIntersectedWithSelfSpeedy,
  getGraphIntersectedWithSelf,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/graphIntersectionHelpers.js"
import {
  cleanBufferedPolygon,
  offsetLinesToGraphIncludingPolygonPointsAtConvexPoints,
  polygonToGraphAndSelectedEdgeIDs,
  polygonToOffsetLinesWithConstantOffset,
  polygonToOffsetLinesWithVaryingOffset,
  preprocessPolygon,
  preprocessPolygonWithSimplification,
} from "./polygonBufferHelpers.js"
import { getCCWPolygon, polygonArea } from "./geometry.js"
import { getAllCounterClockWisePolygonsFromOneDirectionalGraph } from "./polygonsFromGraph.js"

const PRECISION = 1e-8

export function bufferPolygonWithVaryingOffsets(polygonIn, bufferOffsetList, minArea = 100) {
  const polygon = preprocessPolygon(polygonIn)
  const { offsetLines, offsetLinesToIntersect } = polygonToOffsetLinesWithVaryingOffset(polygon, bufferOffsetList)
  const { offsetGraph, edgeIDsToIntersect } = polygonToGraphAndSelectedEdgeIDs(offsetLines, offsetLinesToIntersect)
  const offsetGraphWithIntersections = getGraphIntersectedWithSelfSpeedy(offsetGraph, edgeIDsToIntersect, PRECISION)
  const bufferedPolygons = getAllCounterClockWisePolygonsFromOneDirectionalGraph(
    offsetGraphWithIntersections.vertices,
    offsetGraphWithIntersections.edges,
  )
  return bufferedPolygons.map((p) => cleanBufferedPolygon(p, 0.5)).filter((p) => polygonArea(p) > minArea)
}

/**
 * Buffer a polygon with a constant offset
 * @param {Polygon} polygonIn
 * @param bufferOffset
 * @param minimumBufferDist
 * @param minArea
 * @returns {Polygon[]}
 */
export function bufferPolygon(polygonIn, bufferOffset, minimumBufferDist = false, minArea = 100) {
  const polygon = preprocessPolygonWithSimplification(polygonIn)
  const offsetLines = polygonToOffsetLinesWithConstantOffset(polygon, bufferOffset)
  const minimumBufferDistance = minimumBufferDist ? bufferOffset : minimumBufferDist
  const offsetGraph = offsetLinesToGraphIncludingPolygonPointsAtConvexPoints(
    offsetLines,
    polygon,
    minimumBufferDistance,
    bufferOffset,
  )
  const offsetGraphWithIntersections = getGraphIntersectedWithSelf(offsetGraph)
  const bufferedPolygons = getAllCounterClockWisePolygonsFromOneDirectionalGraph(
    offsetGraphWithIntersections.vertices,
    offsetGraphWithIntersections.edges,
  )
  return bufferedPolygons.map((p) => getCCWPolygon(p)).filter((p) => polygonArea(p) > minArea)
}
