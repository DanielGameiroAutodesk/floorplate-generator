import { type Graph } from "./shapeHelpers.js"
import { type SectionProps, type Sections } from "./lineBuildingGenerator/lib/graphBuilding3000.js"

export type LineBuildingParametersInner = {
  functionId?: string
  width: number
  floorHeight: number
  lineAlignment: "left" | "center" | "right"
  sectionToggle: boolean
  numberOfFloors: number
  minSubBuildingLength: number
  feature: any
  customLayouts: any[]
  analysisParameters?: any
}

export type LineBuildingParameters = LineBuildingParametersInner & {
  graph: Graph
  sectionProps: SectionProps
  sections: Sections
}
