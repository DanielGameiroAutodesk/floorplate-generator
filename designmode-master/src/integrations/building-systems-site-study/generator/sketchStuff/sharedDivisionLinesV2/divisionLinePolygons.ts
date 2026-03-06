import {
  findConnectedEdges,
  getInnerPolygonsFromOffsetGraph,
  getOffsetGraphWithBaseEdgesMapping,
  getOuterAndInnerStepChains,
  getOuterPolygonFromOffsetGraph,
} from "./graphHelpers.js"
import { getGraphTraversalSteps } from "./graphTraversal.js"
import { getGraphIntersectedWithSelf } from "./graphIntersection.js"
import type { SimpleGraph } from "src/integrations/building-systems-site-study/simpleGraph"

type Polygon = [number, number][]

function getPolygonsFromGraph(_baseGraph: SimpleGraph) {
  const baseGraph = getGraphIntersectedWithSelf(_baseGraph)
  const setOfSteps = getGraphTraversalSteps(baseGraph)
  const { outerStepChain, innerStepChains } = getOuterAndInnerStepChains(setOfSteps, baseGraph)

  const outerOffsetGraph = getOffsetGraphWithBaseEdgesMapping(outerStepChain, baseGraph)
  const outerPolygon: Polygon = getOuterPolygonFromOffsetGraph(outerOffsetGraph)

  const innerOffsetGraphs = innerStepChains.map((innerStep) => getOffsetGraphWithBaseEdgesMapping(innerStep, baseGraph))
  const innerPolygonsWithEdgeIds: Polygon[] = innerOffsetGraphs.flatMap((graph) =>
    getInnerPolygonsFromOffsetGraph(graph),
  )

  const overlapLoopPolygonWithEdgeIds: Polygon[] = getInnerPolygonsFromOffsetGraph(outerOffsetGraph)

  const innerPolygons = [...innerPolygonsWithEdgeIds, ...overlapLoopPolygonWithEdgeIds]

  return { outerPolygon, innerPolygons }
}

export function getDivisionLinePolygonsFromGraph(graph: SimpleGraph) {
  const groupedGraphs: SimpleGraph[] = findConnectedEdges(graph)
  return groupedGraphs.flatMap((subGraph) => {
    const { outerPolygon, innerPolygons } = getPolygonsFromGraph(subGraph)
    const rings = [outerPolygon, ...innerPolygons]
    return [{ rings, polygon: outerPolygon }]
  })
}
