import { saveBasic } from "./client/basicElement"
import type { Urn } from "@spacemakerai/element-types"
import type { ElementSystem } from "src/core/element-systems"
import type { Feature } from "geojson"
import { getBasicElementAreaStatsSurfaces } from "./area-stats-surfaces"
import { getOutlinesFromTerrainShape } from "src/core/selection/terrain-shape-outlines"
import type { TerrainShape } from "src/lib/element/types"

export function basicElementSystem(getFootprint: (urn: Urn) => Feature | undefined): ElementSystem {
  return {
    saveHandler: (elementsToSave, authContext) => {
      return saveBasic(elementsToSave, getFootprint, authContext)
    },
    generateAreaStatsSurfaces: getBasicElementAreaStatsSurfaces,
    generateSelectionOutlines2d: ({ element, representations }, globalMatrix, terrainSamplerData) => {
      if (!(element.properties?.category === "road")) return undefined

      const { footprint } = representations

      if (footprint?.geometry.type !== "LineString") return undefined

      const terrainShape: TerrainShape = {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: footprint.geometry }],
      }
      return getOutlinesFromTerrainShape(terrainShape, globalMatrix, terrainSamplerData)
    },
  }
}
