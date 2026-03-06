import type { BufferGeometry, Mesh } from "three"
import type { TerrainTextureProps } from "src/core/terrain/terrain-types"
import type { ElementContainer } from "./ElementContainer"
import type { CustomData } from "./custom-data"
import { createCustomData } from "./custom-data"
import type { Urn } from "forma-elements"

export type BaseTerrainData = {
  baseTerrainUrn: Urn
  baseTerrainGeometry: BufferGeometry
}

export class TerrainData {
  constructor(
    public readonly mesh: Mesh,
    public readonly mapTerrainTexture: TerrainTextureProps | undefined,
    public readonly baseTerrain: BaseTerrainData | undefined, // used when editing terrain pads
  ) {}
}

export const terrainDataSymbol = Symbol("TerrainData")

export function getTerrainCustomData(container: ElementContainer): TerrainData | undefined {
  return container.customData ? (container.customData[terrainDataSymbol] as TerrainData | undefined) : undefined
}

export function createTerrainCustomData(terrainData: TerrainData): CustomData {
  return createCustomData({
    [terrainDataSymbol]: terrainData,
  })
}
