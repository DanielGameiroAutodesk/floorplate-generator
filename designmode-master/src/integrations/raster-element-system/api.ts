import type { FormaElement, Properties } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import type { TerrainTextureRepresentation } from "src/lib/element/types"

export type RasterElement = FormaElement & {
  representations: {
    terrainTexture: TerrainTextureRepresentation
  }
}

export function asRasterElement(value: FormaElement) {
  return value as RasterElement
}

export type RasterElementProperties = Properties & {
  color: string
  name: string
  opacity?: number
}

export interface RasterApi {
  isRasterElement: (element: FormaElement) => boolean
}

const isRasterElement = (element: FormaElement): boolean => {
  return parseUrn(element.urn).system === "raster"
}

export const rasterAPI: RasterApi = {
  isRasterElement,
}
