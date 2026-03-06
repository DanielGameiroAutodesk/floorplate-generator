////
// SectionProps
///

import { getLineBuilding9000 } from "./lineBuildingGenerator/lib/lineBuilding9000/lineBuilding9000.js"
import {
  getGraphBuilding3000,
  type SectionProps,
  type Sections,
} from "./lineBuildingGenerator/lib/graphBuilding3000.js"
import type { LineBuildingParameters } from "./lineBuildingParameters.js"
import type { CustomLayout } from "./LineBuildingTypes.js"
import type { Graph } from "./shapeHelpers.js"
import type { SimpleBuilding } from "./simpleBuilding.js"

//

export type LineBuilding = {
  sections: Sections
  sectionProps: SectionProps
  simpleBuildings: SimpleBuilding[]
}
function generateApartmentBuilding(
  graph: Graph,
  parameters: LineBuildingParameters,
  customLayouts: CustomLayout[],
): LineBuilding {
  const graphBuilding3000: {
    sections: any
    sectionProps: { [sectionID: string]: any }
    simpleBuildings: SimpleBuilding[]
  } = getGraphBuilding3000(graph, parameters, customLayouts)

  const sections = graphBuilding3000.sections as Sections
  const sectionProps = graphBuilding3000.sectionProps as SectionProps
  if (parameters.sectionToggle) {
    return { sections, sectionProps, simpleBuildings: graphBuilding3000.simpleBuildings }
  } else {
    const simpleBuildings: SimpleBuilding[] = getLineBuilding9000(graph, parameters)
    return { sections, sectionProps, simpleBuildings }
  }
}

export const lineBuildingGenerator = {
  name: "ApartmentsOnLine",
  description: () => {
    // Note: This description is not translated via i18n as it's defined in a shared package
    // that doesn't have access to the translation context. The actual translation key
    // is: $.generators.lineBuilding = "Make a line building"
    return "Make a line building"
  },
  inputType: "graph",
  outPutType: "ApartmentBuilding",
  generate: generateApartmentBuilding,
  getParametersSpec: () => {
    return {}
  },
}
