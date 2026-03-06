import { v4 as uuidv4 } from "uuid"

import ArrayUtils from "src/lib/array"

import { addLinesToGraph } from "src/integrations/building-systems-site-study/iterative/graph-edit/fpsCode/addingLinesToGraph"
import { _snapCloseVertices } from "src/integrations/building-systems-site-study/iterative/graph-edit/fpsCode/utils/graphUtils"

import { getDefaultGridParamsBasedOfNode } from "./grid"
import type { GenerateCellGraphParameters, Polygon, SimpleGraph } from "./types"
import { generateCellGraph } from "./adapter"

export type SimpleGraphGeneratorParameters = GenerateCellGraphParameters

export function generateSimpleGraph(parameters: SimpleGraphGeneratorParameters) {
  const innerGraph = generateCellGraph(parameters)
  // generateCellGraph does not produce the enclosing/outer polygon, so we need to add it
  return addPolygonsToGraph(innerGraph, parameters.polygons)
}

function addPolygonsToGraph(graph: SimpleGraph, polygons: Polygon[]): SimpleGraph {
  const lines = polygons.flatMap((polygon) => {
    const vertices = polygon.slice(0, -1).map(([x, y]) => ({ id: uuidv4(), x, y }))
    return ArrayUtils.sliding2([...Array(polygon.length).keys()]).map(([i, j]) => [
      vertices[i],
      vertices[j % vertices.length],
    ])
  })
  const newGraph = addLinesToGraph(graph, lines)
  _snapCloseVertices(newGraph)
  return newGraph
}

export const createDefaultAreaGraphGeneratorConfig = (
  polygons: Polygon[],
): { generatorId: "site-explore-area-graph-v2"; parameters: GenerateCellGraphParameters } =>
  ({
    generatorId: "site-explore-area-graph-v2",
    parameters: {
      polygons,
      technique: "grid2",
      params: getDefaultGridParamsBasedOfNode(polygons),
    },
  }) as const
