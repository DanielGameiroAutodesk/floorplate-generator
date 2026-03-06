import { getGraphIntersectedWithSelf, getGraphWithUpdatedIntersections } from "./graphIntersectionHelpers"
import {
  cleanBufferedPolygon,
  offsetLinesToGraphIncludingPolygonPointsAtConvexPoints,
  polygonToGraphAndSelectedEdgeIDs,
  polygonToOffsetLinesWithConstantOffset,
  polygonToOffsetLinesWithVaryingOffset,
  preprocessPolygon,
  preprocessPolygonWithSimplification,
} from "./polygonBufferHelpers"
import { getCCWPolygon, polygonArea } from "./geometry"
import { getAllCounterClockWisePolygonsFromOneDirectionalGraph } from "./polygonsFromGraph"
import type { Polygon } from "src/integrations/building-systems-common/lib-generators/parkingGenerator/parking"

const PRECISION = 1e-8

export function bufferPolygonWithVaryingOffsets(polygonIn: Polygon, bufferOffsetList: number[], minArea = 100) {
  const polygon = preprocessPolygon(polygonIn)
  const { offsetLines, offsetLinesToIntersect } = polygonToOffsetLinesWithVaryingOffset(polygon, bufferOffsetList)
  const { offsetGraph, edgeIDsToIntersect } = polygonToGraphAndSelectedEdgeIDs(
    offsetLines as Polygon,
    offsetLinesToIntersect,
  )
  const offsetGraphWithIntersections = getGraphWithUpdatedIntersections(offsetGraph, 10, edgeIDsToIntersect, PRECISION)
  const bufferedPolygons = getAllCounterClockWisePolygonsFromOneDirectionalGraph(
    offsetGraphWithIntersections.vertices,
    offsetGraphWithIntersections.edges,
  )
  return bufferedPolygons.map((p) => cleanBufferedPolygon(p, 0.5)).filter((p) => polygonArea(p) > minArea)
}

export function bufferPolygon(polygonIn: Polygon, bufferOffset: number, minimumBufferDist = false, minArea = 100) {
  const polygon = preprocessPolygonWithSimplification(polygonIn)
  const offsetLines = polygonToOffsetLinesWithConstantOffset(polygon, bufferOffset)
  const offsetGraph = offsetLinesToGraphIncludingPolygonPointsAtConvexPoints(
    offsetLines,
    polygon,
    minimumBufferDist,
    bufferOffset,
  )
  const offsetGraphWithIntersections = getGraphIntersectedWithSelf(offsetGraph, 10)
  const bufferedPolygons = getAllCounterClockWisePolygonsFromOneDirectionalGraph(
    offsetGraphWithIntersections.vertices,
    offsetGraphWithIntersections.edges,
  )
  return bufferedPolygons.map((p) => getCCWPolygon(p)).filter((p) => polygonArea(p) > minArea)
}
