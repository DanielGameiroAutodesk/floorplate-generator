import type { SimpleBuilding } from "./simpleBuilding.js"
import type { CustomLayout } from "./LineBuildingTypes.js"
import type { LineBuildingParameters } from "./lineBuildingParameters.js"
import type { Graph } from "./shapeHelpers.js"
import { lineBuildingGenerator } from "./lineBuilding.js"

function makeSimpleBuildings({
  graph,
  parameters,
  customLayouts,
}: {
  graph: Graph
  parameters: any
  customLayouts: CustomLayout[]
}): SimpleBuilding[] {
  return lineBuildingGenerator.generate(graph, parameters, customLayouts).simpleBuildings
}

export const getBakeToSimpleBuildings = (
  parameters: LineBuildingParameters,
  customLayouts: CustomLayout[] = [],
): SimpleBuilding[] => {
  const graph = parameters.graph
  return makeSimpleBuildings({ graph, parameters, customLayouts })
    .map((sb) => ({
      ...sb,
      floors: sb.floors.filter((f) => f.outerShapes.length).map((f) => ({ ...f, functionId: parameters.functionId })),
    }))
    .filter((sb) => sb.floors.length)
}
