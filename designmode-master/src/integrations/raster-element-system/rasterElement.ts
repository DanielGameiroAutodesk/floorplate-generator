import type { ElementSystem } from "src/core/element-systems"
import { saveRasterElements } from "./client"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import type { FeatureCollection, Geometry } from "geojson"

export const rasterElementSystem: ElementSystem = {
  saveHandler: (elementsToSave, authContext) => {
    return saveRasterElements(elementsToSave, authContext)
  },
  generateSelectables: (container): { selectionMode: SelectionMode; selectables: Selectable[] } | undefined => {
    const terrainTextureRepresentation = container.representations.terrainTexture
    if (terrainTextureRepresentation) {
      const bbox = terrainTextureRepresentation.properties.boundingBox
      const geoJson: FeatureCollection<Geometry> = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: bbox,
            },
            properties: {},
          },
        ],
      }
      return {
        selectionMode: "custom-selectables-only",
        selectables: [{ target: { type: "element" }, selectable2d: { terrainShape: geoJson } }],
      }
    }
  },
}
