import { fillCornerWithEmpty, fillEdgeSectionWithEmpty } from "./features/empty.js"
import {
  fillCornerSectionWithCirculation,
  fillEdgeSectionWithCirculation,
} from "./features/circulationFeature/circulation.js"
import { fillCornerSectionWithCustomLayout, fillEdgeSectionWithCustomLayout } from "./customFill.js"
import type { ExtendedEdgeSection, SectionOutlinesCorner } from "./sectionOutlines.js"
import type { CornerSection, EdgeSection } from "../../../lineBuildingGenerator/lib/buildPolygons.js"
import type { LineBuildingParameters } from "../../../lineBuildingParameters.js"
import type { GraphPlus, SectionOutlines, SectionProp } from "../../../lineBuildingGenerator/lib/graphBuilding3000.js"
import type { CustomLayout } from "../../../LineBuildingTypes.js"
import type { Vec2 } from "../../../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"

/////
///
export type PolygonWithHolesVec2 = {
  polygon: Vec2[]
  holes: Vec2[][]
}

export type Unit = PolygonWithHolesVec2 & {
  type: string
  id: string
}
export type Floor = {
  units?: Unit[]
  outerShapes?: PolygonWithHolesVec2[]
  height: number
  id: string
}
export type SectionFillSection = {
  floors: Floor[]
  footPrint: any[]
}

export type Edges = {
  edgeID: string
  sections: SectionFillSection[]
}

export type Corner = {
  vertexID: string
  floors: Floor[]
  footPrint: any[]
}

const NPD = 1e-4

export function doesLayoutFitSection(section: ExtendedEdgeSection | SectionOutlinesCorner, customLayout: CustomLayout) {
  if (!section) return false
  if (section?.type === "Rectangle" && customLayout?.sectionType === "Rectangle") {
    if (Math.abs(section.width - customLayout.width) > NPD) return false
    return Math.abs((section.length ?? 0) - customLayout.length) < NPD
  }
  if (section?.type === "Corner" && customLayout?.sectionType === "Corner") {
    if (Math.abs(section.width - customLayout.width) > NPD) return false

    const longestLeg = Math.max(section.startLeg, section.endLeg)
    const shortestLeg = Math.min(section.startLeg, section.endLeg)
    const positiveAngle = Math.abs(section.angle)

    if (Math.abs(longestLeg - customLayout.startLeg) > NPD) return false
    if (Math.abs(shortestLeg - customLayout.endLeg) > NPD) return false
    return Math.abs(positiveAngle - customLayout.angle) < NPD
  }
  return false
}

export function fillSectionsWithCustomLayout(
  edgeSections: EdgeSection[],
  cornerSections: CornerSection[],
  settings: LineBuildingParameters,
  sectionProps: Record<string, SectionProp>,
  subGraph: GraphPlus,
  sectionOutlines: SectionOutlines,
  customLayouts: CustomLayout[],
) {
  const edges: Record<string, Edges> = {}
  for (let i = 0; i < edgeSections.length; i++) {
    const edgeData = edgeSections[i]
    const edgeID = edgeData.edge.id

    const sections = edgeData.sections.map((section, i) => {
      const sectionID = edgeID + "::" + i
      const feature = sectionProps[sectionID]?.feature
      const featureName = sectionProps[sectionID]?.feature?.name
      if (featureName === "Circulation" && feature) {
        return fillEdgeSectionWithCirculation({ section, settings, feature })
      }
      if (featureName === "CustomLayout" && feature) {
        const customLayout = customLayouts.find((customLayout) => {
          return "customLayoutID" in feature && customLayout.id === feature.customLayoutID
        })
        const sectionOutline = sectionOutlines.edges[edgeID][i]
        if (customLayout && doesLayoutFitSection(sectionOutline, customLayout))
          return fillEdgeSectionWithCustomLayout(section, customLayout, feature?.settings as any)

        return fillEdgeSectionWithEmpty(section, settings)
      }
      return fillEdgeSectionWithEmpty(section, settings)
    })
    edges[edgeID] = { edgeID, sections }
  }

  const corners: Record<string, Corner> = {}
  for (let i = 0; i < cornerSections.length; i++) {
    const cornerSectionData = cornerSections[i]
    const vertexID = cornerSectionData.vertex.id
    const sectionID = vertexID + "::" + 0
    const cornerProps = sectionProps[sectionID]
    const feature = cornerProps?.feature
    const featureName = cornerProps?.feature?.name

    if (featureName === "Circulation" && feature) {
      const { floors, footPrint } = fillCornerSectionWithCirculation({
        section: cornerSectionData,
        settings,
        feature,
        subGraph,
      })
      corners[vertexID] = { vertexID, floors, footPrint }
    } else if (featureName === "CustomLayout" && feature) {
      const customLayout = customLayouts.find((customLayout) => {
        return "customLayoutID" in feature && customLayout.id === feature.customLayoutID
      })
      const sectionOutline = sectionOutlines.corners[vertexID]
      const layoutFitSection = customLayout ? doesLayoutFitSection(sectionOutline, customLayout) : false
      if (customLayout && layoutFitSection) {
        const { floors, footPrint } = fillCornerSectionWithCustomLayout({
          cornerSection: cornerSectionData,
          customLayout: customLayout,
        })
        corners[vertexID] = { vertexID, floors, footPrint }
      } else {
        const { floors, footPrint } = fillCornerWithEmpty(cornerSectionData, settings)
        corners[vertexID] = { vertexID, floors, footPrint }
      }
    } else {
      const { floors, footPrint } = fillCornerWithEmpty(cornerSectionData, settings)
      corners[vertexID] = { vertexID, floors, footPrint }
    }
  }
  return { edges, corners }
}
