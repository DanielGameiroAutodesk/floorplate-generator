import type { CustomLayoutData } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/LineBuildingMenus"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { DrawSetting } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/types"

function getProjectLevelCustomLayouts(customLayoutData: CustomLayoutData) {
  const projectLevel = [...customLayoutData.projectLevelLayouts]
  return projectLevel.sort((a, b) => {
    // if (b.revision !== undefined && a.revision !== undefined) {
    //   return parseFloat(b.revision) - parseFloat(a.revision)
    // }
    // if (a.revision !== undefined) return -1
    // if (b.revision !== undefined) return 1
    return b.id.localeCompare(a.id)
  })
}

function getLocalCustomLayouts(customLayoutData: CustomLayoutData) {
  const local = [...customLayoutData.customLayouts]

  return local.sort((a, b) => {
    // if (b.revision !== undefined && a.revision !== undefined) {
    //   return parseFloat(b.revision) - parseFloat(a.revision)
    // }
    // if (a.revision !== undefined) return -1
    // if (b.revision !== undefined) return 1
    return b.id.localeCompare(a.id)
  })
}

function filterCustomLayoutsByDrawSetting(allCustomLayouts: CustomLayout[], drawSetting: DrawSetting | undefined) {
  return allCustomLayouts.filter((customLayout) => {
    if (drawSetting?.sectionType === "Rectangle" && customLayout.sectionType === "Rectangle") {
      const dw = Math.abs(drawSetting.width - customLayout.width)
      const dl = Math.abs(drawSetting.length - customLayout.length)
      return dw < 1e-5 && dl < 1e-5
    }
    if (drawSetting?.sectionType === "Corner" && customLayout.sectionType === "Corner") {
      if (Math.abs(drawSetting.startLeg - customLayout.startLeg) > 1e-5) return false
      if (Math.abs(drawSetting.endLeg - customLayout.endLeg) > 1e-5) return false
      if (Math.abs(drawSetting.width - customLayout.width) > 1e-5) return false
      if (Math.abs(drawSetting.angle - customLayout.angle) > 1e-5) return false
      return true
    }
    return false
  })
}

export function getProjectLevelCustomLayoutsFilteredByDrawSetting(
  customLayoutData: CustomLayoutData,
  drawSettings: DrawSetting | undefined,
) {
  const allCustomLayouts = getProjectLevelCustomLayouts(customLayoutData)
  return filterCustomLayoutsByDrawSetting(allCustomLayouts, drawSettings)
}
export function getLocalCustomLayoutsFilteredByDrawSetting(
  customLayoutData: CustomLayoutData,
  drawSettings: DrawSetting | undefined,
) {
  const allCustomLayouts = getLocalCustomLayouts(customLayoutData)
  return filterCustomLayoutsByDrawSetting(allCustomLayouts, drawSettings)
}
