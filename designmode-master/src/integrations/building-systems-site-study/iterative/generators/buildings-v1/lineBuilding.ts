/* eslint-disable import/order */
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"

import { ElementContainer } from "src/core/elements/ElementContainer"
/* eslint-enable import/order */
import { getDefaultLineBuildingParams } from "src/integrations/building-systems-line-buildings/quickDrawState"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"

import type { ExploreBuildingParameters } from "./generator"
import type { ExploreLinearBuilding } from "./adapter"

export function createLineBuildingForExplore(
  params: ExploreBuildingParameters,
  building: ExploreLinearBuilding,
  imperialFlag: boolean,
) {
  const parameters: LineBuildingParameters = {
    ...getDefaultLineBuildingParams(imperialFlag),
    graph: building.graph,
    width: building.width,
    floorHeight: params.floorHeight,
    numberOfFloors: params.floors,
    sectionProps: {},
    sections: {},
  }

  const { element, geometry } = lineBuildingApi.run(parameters)

  return ElementContainer.fromDraftElement(element, [], {
    volumeMesh: geometry,
    terrainShape: undefined,
    footprint: undefined,
    terrainTexture: undefined,
    buildingFloors3DSketch_UNSTABLE: undefined,
  })
}
