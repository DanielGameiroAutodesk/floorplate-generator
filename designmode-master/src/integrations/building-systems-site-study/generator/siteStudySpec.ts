import type { TreeAreaConfig } from "src/integrations/basic-elements/trees/area/TreeAreaGenerator"
import type { Polygon } from "src/integrations/building-systems-line-buildings/bufferPolygon/lib/Types"
import type { SimpleBuilding } from "src/integrations/building-systems-simple-buildings/simpleBuilding"
import type { SimpleGraph } from "src/integrations/building-systems-site-study/simpleGraph"
import type { SiteStudyInputPolygon } from "src/integrations/building-systems-site-study/SiteStudyToolState"

export type SiteStudyParams = {
  buildingWidth: number
  pointBuildingWidth: number
  siteBuffer: number
  streetWidth: number
  avgStories: number
  layoutTypes: {
    closedCityBlock: boolean
    openCityBlock: boolean
    twoAngled: boolean
    oneAngled: boolean
    fanBuildings: boolean
    eTypeLamellas: boolean
    oneAngledTower: boolean
    openCityBlockPointHouseMix: boolean
    smileyBlock: boolean
    cityBlocksWithGaps: boolean
    POINT_BUILDINGS: boolean
    shiftedBuildings: boolean
  }
  roads: boolean
  trees: { enabled: true; config: TreeAreaConfig } | { enabled: false }
  clampToTerrain: boolean
}

export type ParkArea = { outerLimit: Polygon; buildingFootPrints: Polygon[] }

export type SiteStudy = {
  simpleBuildings: SimpleBuilding[]
  roadGraph: SimpleGraph
  parkAreas: ParkArea[]
  studyPolygon: SiteStudyInputPolygon
}

export type SiteStudyInput = {
  studyPolygon: { x: number; y: number }[]
  parameters: SiteStudyParams
}
