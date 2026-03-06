import type { FormaElement, Representation, Urn } from "@spacemakerai/element-types"
import type { Mesh, Texture } from "three"
import type { PrepassData } from "./2d-raytracer"
import type { InternalPath } from "src/lib/element/path"

export type TerrainSamplerData = PrepassData

type OperationBase = {
  id: string
  meta?: {
    origin?: {
      proposalId?: string
      path?: string
      urn?: string
    }
    counter?: number // Used to keep track of order of creation of operations for layer list
  }
}
export type FlatPolygonV1 = OperationBase & {
  type: "flat-polygon/v1"
  coordinates: { x: number; y: number }[]
  elevation: number
  buffer?: number
  applyGrade?: boolean
}

export type TerrainOperation = FlatPolygonV1

export type TerrainElement = FormaElement & {
  representations: {
    volumeMesh: Representation
    raster: Representation<
      never,
      {
        properties: {
          bbox: number[][]
          minMax: [number, number]
          size: [number, number]
          resolution: number
        }
      }
    >
  }
  properties: {
    baseUrn?: Urn
    category: "terrain"
    bbox: [number, number][]
    terrain_mode_operations?: TerrainOperation[]
    geoReference: { srid: number; refPoint: [number, number] }
  }
}

export function isTerrainElement(element: FormaElement): element is TerrainElement {
  return element.properties?.category === "terrain"
}

export type TerrainTextureProps = {
  terrainTexture: Texture
  attributionTag?: string
}

export type TerrainState = {
  terrainSamplerData: TerrainSamplerData
  mapTerrainTexture: TerrainTextureProps | undefined
  meshTerrain: Mesh
  path: InternalPath
}

export type TerrainMaterial = "transparent" | "contour" | "map" | "satellite"
