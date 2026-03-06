import { defaultTreeAreaConfig } from "src/integrations/basic-elements/trees/defaults"
import type { SiteStudyParams } from "./siteStudySpec"

export const FEET_TO_METER = 0.3048

export function getDefaultSiteStudyParams(imperialFlag: boolean): SiteStudyParams {
  return {
    buildingWidth: imperialFlag ? 40 * FEET_TO_METER : 12,
    pointBuildingWidth: imperialFlag ? 70 * FEET_TO_METER : 18,
    layoutTypes: {
      closedCityBlock: true,
      openCityBlock: true,
      twoAngled: true,
      oneAngled: true,
      fanBuildings: true,
      eTypeLamellas: true,
      oneAngledTower: true,
      openCityBlockPointHouseMix: true,
      smileyBlock: true,
      cityBlocksWithGaps: true,
      POINT_BUILDINGS: true,
      shiftedBuildings: true,
    },
    siteBuffer: imperialFlag ? 40 * FEET_TO_METER : 12,
    streetWidth: imperialFlag ? 20 * FEET_TO_METER : 6,
    avgStories: 4,
    roads: true,
    trees: { enabled: true, config: defaultTreeAreaConfig(imperialFlag) },
    clampToTerrain: true,
  }
}
