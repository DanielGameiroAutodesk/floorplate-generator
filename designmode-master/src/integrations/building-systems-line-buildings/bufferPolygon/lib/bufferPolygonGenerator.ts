import {
  offsetLinesToGraphIncludingPolygonPointsAtConvexPoints,
  polygonToOffsetLinesWithConstantOffset,
  preprocessPolygonWithSimplification,
} from "./polygonBufferHelpers"
import { getGraphIntersectedWithSelf } from "./graphIntersectionHelpers"
import { getAllCounterClockWisePolygonsFromOneDirectionalGraph } from "./polygonsFromGraph"
import { getCCWPolygon, polygonArea } from "./geometry"

import type { Polygon } from "./Types"

export function runBufferedPolygon(
  polygonIn: Polygon,
  bufferOffset: number,
  minimumBufferDist = false,
  minArea = 1e-1,
) {
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
