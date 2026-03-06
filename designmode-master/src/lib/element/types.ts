import type * as GeoJson from "geojson"
import type { JsonRepresentations, Representation, TerrainShapeFeatureProperties } from "forma-elements"

// This is a temporary extension of properties to make it compatible with reference images and property boundaries
// from the old footprint usage
export type TerrainShapeFeaturePropertiesWithExtensions = TerrainShapeFeatureProperties & {
  fill?: { imgUrl?: string }
  stroke?: { dashed?: boolean }
}

export type TerrainShape = GeoJson.FeatureCollection<
  GeoJson.Geometry,
  TerrainShapeFeaturePropertiesWithExtensions | null
>

export function terrainShapeWithExtensions(data: JsonRepresentations["terrainShape"]) {
  return data as TerrainShape
}

/** New area metric representation */

export type GrossFloorArea = {
  /** Elevation relative to the element that has this representation */
  elevation: number
  /** Gross polygon for the area. List of rings of [x,y] points. First ring is the outer polygon, rest are holes */
  coordinates: number[][][]
}

export type GFAUnit = {
  functionId?: string
  areaType?: string
  areas: GrossFloorArea[]
}

export type TerrainTextureRepresentation = {
  blobId: string
  properties: {
    boundingBox: number[][][]
    color: string
    opacity: number
    mimeType: string
  }
}

declare module "forma-elements" {
  interface Representations {
    /** List of units and their tags and corresponding areas. Used to interact with Area Metrics */
    gfaUnits?: Representation<GFAUnit[]>
    terrainTexture?: Representation<TerrainTextureRepresentation>
  }
}
