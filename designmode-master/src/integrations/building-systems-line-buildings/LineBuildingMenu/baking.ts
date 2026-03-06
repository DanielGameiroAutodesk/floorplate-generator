import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import { corridorSideSwitchedAfterNormalization, getDrawSettingFromSection } from "./drawSettings"
import {
  CornerCirculationToFloorPlan,
  rectangleCirculationToFloorPlan,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/sectionFill/features/circulationFeature/circulation"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import { newRevision } from "src/lib/element/urn"
import type { CornerSection, RectangleSection, SectionSelection } from "./types"
import type { CirculationFeature } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"

export function getBakedLineBuildingParameters(
  params: LineBuildingParameters,
  sectionSelection: SectionSelection,
): LineBuildingParameters | undefined {
  if (!params.sectionToggle) return
  const updatedParams = { ...params }
  const plansPrDrawSettingHash: Record<string, any> = {}
  sectionSelection.activeSectionIds.forEach((id) => {
    const section = params.sections[id]

    const feature = params.sectionProps[id]?.feature
    if (section.sectionType === "Rectangle" && feature?.name === "Circulation") {
      const drawSetting = getDrawSettingFromSection(section, params.width) as RectangleSection
      const hash = `${drawSetting.length}:${drawSetting.width}:${feature.settings.corridorWidth.value}:${feature.settings.corridorAlignment.value}`
      let customLayoutId: string
      if (!plansPrDrawSettingHash[hash]) {
        const floors = rectangleCirculationToFloorPlan(drawSetting.length, drawSetting.width, feature) as any[]
        const customLayout: CustomLayout = {
          floors,
          id: Math.random().toString(16).slice(2),
          sectionType: "Rectangle",
          name: "Circulation",
          revision: newRevision(),
          length: drawSetting.length,
          width: drawSetting.width,
        }
        plansPrDrawSettingHash[hash] = customLayout
        updatedParams.customLayouts = [...updatedParams.customLayouts, customLayout]
        customLayoutId = customLayout.id
      } else {
        customLayoutId = plansPrDrawSettingHash[hash].id
      }
      updatedParams.sectionProps = {
        ...updatedParams.sectionProps,
        [id]: {
          ...updatedParams.sectionProps[id],
          feature: { name: "CustomLayout", customLayoutID: customLayoutId, settings: { flipX: false, flipY: false } },
        },
      }
    }
    if (section.sectionType === "Corner" && feature?.name === "Circulation") {
      const drawSetting = getDrawSettingFromSection(section, params.width) as CornerSection
      const corridorSideSwitched = corridorSideSwitchedAfterNormalization(section)
      let corridorAlignment = feature.settings.corridorAlignment.value
      if (corridorSideSwitched) {
        if (corridorAlignment === "left") corridorAlignment = "right"
        else if (corridorAlignment === "right") corridorAlignment = "left"
      }
      const hash = `${drawSetting.startLeg}:${drawSetting.endLeg}:${drawSetting.angle}:${drawSetting.width}:${feature.settings.corridorWidth.value}:${corridorAlignment}`
      let customLayoutId: string
      if (plansPrDrawSettingHash[hash]) {
        customLayoutId = plansPrDrawSettingHash[hash].id
      } else {
        const customLayout = floorPlanLayoutFromCornerSction(drawSetting, feature, corridorAlignment)
        plansPrDrawSettingHash[hash] = customLayout
        updatedParams.customLayouts = [...updatedParams.customLayouts, customLayout]
        customLayoutId = customLayout.id
      }
      const newSectionProps = {
        feature: { name: "CustomLayout", customLayoutID: customLayoutId, settings: { flipX: false, flipY: false } },
      } as const
      updatedParams.sectionProps = {
        ...updatedParams.sectionProps,
        [id]: {
          ...updatedParams.sectionProps[id],
          ...newSectionProps,
        },
      }
    }
  })
  return updatedParams
}

//////
// Apartment building edit menu
///

function floorPlanLayoutFromCornerSction(
  drawSetting: CornerSection,
  feature: CirculationFeature,
  corridorAlignment: "center" | "left" | "right",
) {
  const floors = CornerCirculationToFloorPlan({
    startLeg: drawSetting.startLeg,
    endLeg: drawSetting.endLeg,
    angle: drawSetting.angle,
    width: drawSetting.width,
    feature,
    corridorAlignment,
  }) as any[]

  const customLayout: CustomLayout = {
    floors,
    id: Math.random().toString(16).slice(2),
    sectionType: "Corner",
    name: "Circulation",
    revision: newRevision(),
    width: drawSetting.width,
    startLeg: drawSetting.startLeg,
    endLeg: drawSetting.endLeg,
    angle: drawSetting.angle,
  }
  return customLayout
}
