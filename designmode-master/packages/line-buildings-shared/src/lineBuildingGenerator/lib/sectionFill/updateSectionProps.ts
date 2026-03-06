import { doesLayoutFitSection } from "./getSectionFill.js"
import type { ExtendedEdgeSection, SectionOutlinesCorner } from "./sectionOutlines.js"
import type { LineBuildingParameters } from "../../../lineBuildingParameters.js"
import type { CustomLayout } from "../../../LineBuildingTypes.js"
import type {
  CustomFeature,
  SectionOutlines,
  SectionProp,
} from "../../../lineBuildingGenerator/lib/graphBuilding3000.js"

function pruneUnfittingCustomLayouts(
  newSectionProps: Record<string, SectionProp>,
  sectionID: string,
  customLayouts: CustomLayout[],
  sectionOutline: any,
) {
  const feature = newSectionProps[sectionID].feature! as CustomFeature
  const customLayoutID = feature.customLayoutID
  const customLayout = customLayouts.find((customLayout) => {
    return customLayout.id === customLayoutID
  })
  const fit = customLayout ? doesLayoutFitSection(sectionOutline, customLayout) : false
  if (!fit) newSectionProps[sectionID] = { ...newSectionProps[sectionID], feature: undefined }
}

function getSectionPropsForNewCorner(settings: LineBuildingParameters, cornerSection: SectionOutlinesCorner) {
  const vertexID = cornerSection.vertexID
  const graph = settings.graph
  const sectionProps = settings.sectionProps

  const startEdge = Object.values(graph.edges).find((edge) => edge.end === vertexID)
  const numberOfPropsPrevEdge = Object.keys(sectionProps).filter((sectionId) => {
    const [edgeId] = sectionId.split("::")
    return edgeId === startEdge?.id
  }).length
  const prevSectionPropId = startEdge ? startEdge.id + "::" + (numberOfPropsPrevEdge - 1) : ""
  const prevSectionProp = sectionProps[prevSectionPropId]
  if (prevSectionProp) {
    const feature = prevSectionProp.feature?.name === "Circulation" ? prevSectionProp.feature : undefined
    return {
      feature: feature,
      numberOfFloors: prevSectionProp.numberOfFloors,
      startLeg: cornerSection.startLeg,
      endLeg: cornerSection.endLeg,
    }
  }

  const endEdge = Object.values(graph.edges).find((edge) => edge.start === vertexID)
  const nextSectionPropId = endEdge?.id + "::" + 0
  const nextSectionProp = sectionProps[nextSectionPropId]
  if (nextSectionProp) {
    const feature = nextSectionProp.feature?.name === "Circulation" ? nextSectionProp.feature : undefined
    return {
      feature: feature,
      numberOfFloors: nextSectionProp.numberOfFloors,
      startLeg: cornerSection.startLeg,
      endLeg: cornerSection.endLeg,
    }
  }

  return {
    feature: settings.feature,
    numberOfFloors: settings.numberOfFloors,
    startLeg: cornerSection.startLeg,
    endLeg: cornerSection.endLeg,
  }
}

function getNewSectionPropForEdgeSection(settings: LineBuildingParameters, edgeSection: ExtendedEdgeSection) {
  const edgeId = edgeSection.edgeID

  const graph = settings.graph
  const edge = graph.edges[edgeId]

  const prevCornerId = edge.start
  const nextCornerId = edge.end

  const sectionProps = settings.sectionProps

  const prevCornerSectionId = prevCornerId + "::" + 0
  const prevCornerProps = sectionProps[prevCornerSectionId]
  if (prevCornerProps) {
    const feature = prevCornerProps.feature?.name === "Circulation" ? prevCornerProps.feature : undefined
    return {
      feature: feature,
      numberOfFloors: prevCornerProps.numberOfFloors,
      minSubBuildingLength: settings.minSubBuildingLength,
    }
  }

  const nextCornerSectionId = nextCornerId + "::" + 0
  const nextCornerProps = sectionProps[nextCornerSectionId]
  if (nextCornerProps) {
    const feature = nextCornerProps.feature?.name === "Circulation" ? nextCornerProps.feature : undefined
    return {
      feature: feature,
      numberOfFloors: nextCornerProps.numberOfFloors,
      minSubBuildingLength: settings.minSubBuildingLength,
    }
  }

  return {
    feature: settings.feature,
    numberOfFloors: settings.numberOfFloors,
    minSubBuildingLength: settings.minSubBuildingLength,
  }
}

export function getUpdatedSectionProps(
  settings: LineBuildingParameters,
  sectionOutlines: SectionOutlines,
  customLayouts: CustomLayout[],
) {
  const oldSectionProps = settings.sectionProps || {}

  const newSectionProps: Record<string, SectionProp> = {}

  Object.values(sectionOutlines.corners).forEach((cornerSection) => {
    const sectionID = cornerSection.vertexID + "::" + 0
    if (oldSectionProps[sectionID]) {
      newSectionProps[sectionID] = {
        ...oldSectionProps[sectionID],
        startLeg: cornerSection.startLeg,
        endLeg: cornerSection.endLeg,
      } as SectionProp
    } else {
      newSectionProps[sectionID] = getSectionPropsForNewCorner(settings, cornerSection) as SectionProp
    }

    if (newSectionProps[sectionID].feature?.name === "CustomLayout") {
      pruneUnfittingCustomLayouts(newSectionProps, sectionID, customLayouts, cornerSection)
    }
  })

  Object.values(sectionOutlines.edges).forEach((edgeSections) => {
    let prevProps
    for (let i = 0; i < edgeSections.length; i++) {
      const edgeSection = edgeSections[i]
      const sectionID = edgeSection.edgeID + "::" + i
      if (oldSectionProps[sectionID]) {
        newSectionProps[sectionID] = oldSectionProps[sectionID]
      } else if (prevProps) {
        newSectionProps[sectionID] = { ...prevProps }
      } else {
        newSectionProps[sectionID] = getNewSectionPropForEdgeSection(settings, edgeSection)
      }

      if (newSectionProps[sectionID].feature?.name === "CustomLayout") {
        pruneUnfittingCustomLayouts(newSectionProps, sectionID, customLayouts, edgeSection)
      }
      prevProps = newSectionProps[sectionID]
    }
  })

  return newSectionProps
}
