import { parametricElementClient, transformParametricElement } from "./parametricElementClient"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { BufferGeometry } from "three"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { isPrivateOutdoorSpaceElement } from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import ArrayUtils from "src/lib/array"

import type { ElementSystem, SnappingLine } from "src/core/element-systems"
import { NO_OVERRIDE } from "src/core/element-systems"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import { getParametricAreaStatsSurfaces } from "./area-stats-surfaces"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import {
  generateSiteExploreAreaGraphGeneratorElementSelectables,
  generateSiteExploreAreaGeneratorElementSnappingLines,
  isSiteExploreAreaElement,
  isSiteExploreAreaGraphGeneratorElement,
} from "src/integrations/building-systems-site-study/iterative/site-explore-area"
import transportationApi from "src/integrations/transportation/lib/transportationApi"
import { generateOutlines2d as generateStreetOutlines2d } from "src/integrations/transportation/glue"

export function parametricElementSystem(getVolumeMeshByUrn: (urn: Urn) => BufferGeometry | undefined): ElementSystem {
  return {
    elementsClientLoadTransform: transformParametricElement,
    saveHandler: (elementsToSave, authContext) => {
      return parametricElementClient.save(elementsToSave, getVolumeMeshByUrn, authContext)
    },
    applyVisualizationSettings_DEPRECATED(element, visualizationSettings) {
      if (lineBuildingApi.isLineBuildingFormaElement(element)) {
        return new Map([[element.urn, lineBuildingApi.generateVisualizationMesh(element, visualizationSettings)]])
      }
      if (rowHouseApi.isRowHouseElement(element)) {
        return new Map([[element.urn, rowHouseApi.createVisualizationMesh(element, visualizationSettings)]])
      }
      return undefined
    },
    generateUnitMeshes(element: FormaElement): BuildingPieceMesh[] | typeof NO_OVERRIDE {
      if (rowHouseApi.isRowHouseElement(element)) {
        return rowHouseApi.generateUnitVisualization(element)
      }
      if (lineBuildingApi.isLineBuildingFormaElement(element)) {
        return lineBuildingApi.generateUnitVisualization(element)
      }
      return NO_OVERRIDE
    },
    generateEdgeOutlines: (element) => {
      if (rowHouseApi.isRowHouseElement(element)) {
        return rowHouseApi.buildOutLines(element)
      }
      if (lineBuildingApi.isLineBuildingFormaElement(element)) {
        return lineBuildingApi.getSelectionOutline(element)
      }
      return undefined
    },
    generateSelectionOutlines2d: (container, globalMatrix, terrainSamplerData) => {
      if (transportationApi.isTransportationElement(container.element)) {
        return generateStreetOutlines2d(container.element, globalMatrix, terrainSamplerData)
      }
      return undefined
    },
    generateVolume25D: (element: FormaElement) => {
      if (lineBuildingApi.isLineBuildingFormaElement(element)) {
        return lineBuildingApi.generateVolume25D(element)
      }
    },

    generateSnappingLines: (element: FormaElement) => {
      if (isPrivateOutdoorSpaceElement(element)) {
        return element.properties.privateOutdoorSpace.spaces.flatMap((space): SnappingLine[] =>
          space.polygons.flatMap((polygon): SnappingLine[] =>
            ArrayUtils.sliding2([...polygon, polygon[0]]).map(([start, end]) => ({ start, end, onTerrain: true })),
          ),
        )
      }
      if (isSiteExploreAreaElement(element)) {
        return generateSiteExploreAreaGeneratorElementSnappingLines(element)
      }
      return undefined
    },

    canGenerateVolume25D: (element: FormaElement) => {
      return lineBuildingApi.isLineBuildingFormaElement(element)
    },

    generateAreaStatsSurfaces: getParametricAreaStatsSurfaces,

    generateSelectables: (
      container: ElementContainer,
    ): { selectionMode: SelectionMode; selectables: Selectable[] } | undefined => {
      if (isSiteExploreAreaGraphGeneratorElement(container.element)) {
        return generateSiteExploreAreaGraphGeneratorElementSelectables(container.element)
      }
      return undefined
    },
  }
}
