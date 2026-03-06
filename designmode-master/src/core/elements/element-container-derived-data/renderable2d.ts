import type { ElementContainer } from "src/core/elements/ElementContainer"
import { minimumRenderableFromTerrainTexture as minimumRenderableFromTerrainTexture } from "src/integrations/renderables/raster"
import { minimumRenderableFromTerrainShape } from "src/integrations/renderables/terrainShape"
import { createParameterizedDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const renderables2dController = createParameterizedDerivedDataController(computeRenderables2d)

function computeRenderables2d({ scale }: { scale: number }) {
  return function (container: ElementContainer) {
    const terrainShape = container.representations.terrainShape
    const terrainTexture = container.representations.terrainTexture
    if (terrainTexture) {
      return minimumRenderableFromTerrainTexture(terrainTexture)
    }
    if (terrainShape) {
      return minimumRenderableFromTerrainShape(terrainShape, scale)
    }
    return []
  }
}
