import { getAutoSections } from "./autoSections.js"
import { getBuildingSectionFromGraph } from "./buildPolygons.js"
import {
  type ExtendedEdgeSection,
  getSectionOutlines,
  type SectionOutlinesCorner,
} from "./sectionFill/sectionOutlines.js"
import { getUpdatedSectionProps } from "./sectionFill/updateSectionProps.js"
import { fillSectionsWithCustomLayout } from "./sectionFill/getSectionFill.js"
import { getSimpleBuildingFromBuildingCustomBySection } from "./customLayoutToSimpleBuildings.js"
import type { LineBuildingParameters } from "../../lineBuildingParameters.js"
import type { CustomLayout } from "../../LineBuildingTypes.js"
import type { SimpleBuilding } from "../../simpleBuilding.js"
import type { Graph, GraphEdge, GraphVertex } from "../../shapeHelpers.js"

export function makeGraphPlus(graph: Graph, settings: { width: number }) {
  const width = settings.width
  const graphCopy: Graph = structuredClone(graph)
  Object.values(graphCopy.edges).forEach((edge: any) => {
    edge.width = width
  })
  return { vertices: graphCopy.vertices, edges: graphCopy.edges as Record<string, EdgePlus> } as GraphPlus
}

type GraphBuilding3000 = {
  sections: Sections
  sectionProps: SectionProps
  simpleBuildings: SimpleBuilding[]
}
export type EdgePlus = GraphEdge & { width: number }
export type GraphPlus = {
  vertices: Record<string, GraphVertex>
  edges: Record<string, EdgePlus>
}

export function getGraphBuilding3000(
  buildingGraph: Graph,
  settings: LineBuildingParameters,
  customLayouts: CustomLayout[],
): GraphBuilding3000 {
  if (Object.values(buildingGraph.edges).length === 0) {
    return { sections: {}, sectionProps: {}, simpleBuildings: [] }
  }

  const graphPlus = makeGraphPlus(buildingGraph, settings)
  const autoSectionCuts = getAutoSections(graphPlus, settings)
  const { cornerSections, edgeSections } = getBuildingSectionFromGraph(graphPlus, autoSectionCuts, settings)

  const {
    sections,
    sectionDividedByEdgesAndCorners,
  }: {
    sections: Record<string, Section>
    sectionDividedByEdgesAndCorners: SectionOutlines
  } = getSectionOutlines(edgeSections, cornerSections, settings)
  const updatedSectionProps = getUpdatedSectionProps(settings, sectionDividedByEdgesAndCorners, customLayouts)
  const customLayoutFill = fillSectionsWithCustomLayout(
    edgeSections,
    cornerSections,
    settings,
    updatedSectionProps,
    graphPlus,
    sectionDividedByEdgesAndCorners,
    customLayouts,
  )

  const simpleBuildings = getSimpleBuildingFromBuildingCustomBySection(customLayoutFill, {
    ...settings,
    sectionProps: updatedSectionProps,
    sections: sections,
  })

  return {
    sections: sections as Sections,
    sectionProps: updatedSectionProps as SectionProps,
    simpleBuildings: simpleBuildings,
  }
}

type FootPrint = [number, number][]
export type EdgeSection = {
  sectionType: "Rectangle" | "Split"
  footPrint: FootPrint
  length: number
}
export type CornerSection = {
  sectionType: "Corner"
  footPrint: FootPrint
  startLeg: number
  endLeg: number
  angle: number
}
export type Section = EdgeSection | CornerSection
export type Sections = Record<string, Section>
export type CustomFeature = {
  name: "CustomLayout"
  customLayoutID: string
  settings: { flipX: boolean; flipY: boolean }
}
export type CirculationFeature = {
  name: "Circulation"
  settings: { corridorWidth: { value: number }; corridorAlignment: { value: "center" | "left" | "right" } }
}
export type Feature = CirculationFeature | CustomFeature
export type EdgeSectionProp = {
  numberOfFloors: number
  minSubBuildingLength: number
  feature?: Feature
}
export type CornerSectionProp = { numberOfFloors: number; startLeg: number; endLeg: number; feature?: Feature }
export type SectionProp = EdgeSectionProp | CornerSectionProp
export type SectionProps = { [sectionID: string]: SectionProp }

export type SectionOutlines = {
  edges: Record<string, ExtendedEdgeSection[]>
  corners: Record<string, SectionOutlinesCorner>
}
