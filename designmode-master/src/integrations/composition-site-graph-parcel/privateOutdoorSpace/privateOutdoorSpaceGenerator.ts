import type { FormaElement, TerrainShapeFeatureProperties } from "@spacemakerai/element-types"
import { createUrn, newId, newRevision } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import type { TerrainShape } from "src/lib/element/types"
import type { Feature, Geometry } from "geojson"
import type { Point, Polygon } from "src/integrations/composition-row-house-generator/types"

const GENERATOR_ID = "outdoor-area-generator"
const SYSTEM = "parametric"

export type Space = {
  polygons: Polygon[]
}
type Parameters = {
  width: number
  depth: number
}

const parcelColors = {
  fill: "#84AF67",
  outline: "#6C994E",
}

function privateOutdoorSpaceToTerrainShape(yards: Space[], elementId: string): TerrainShape {
  return yards.reduce<TerrainShape>(
    (prev, curr) => {
      const newFeatures: Feature<Geometry, TerrainShapeFeatureProperties>[] = curr.polygons.flatMap(
        (p, i): Feature<Geometry, TerrainShapeFeatureProperties> => ({
          id: `${elementId}-${i}`,
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[...p, p[0]]] },
          properties: {
            fill: {
              color: parcelColors.fill,
              opacity: 0.7,
            },
            stroke: {
              color: parcelColors.outline,
              lineWidth: 0.5,
            },
          },
        }),
      )
      prev.features.push(...newFeatures)
      return prev
    },
    { type: "FeatureCollection", features: [] },
  )
}

export type PrivateOutdoorSpaceElement = {
  properties: {
    generator: {
      generatorId: string
      parameters: {
        width: number
        depth: number
      }
    }
    privateOutdoorSpace: {
      spaces: Space[]
    }
    category: string
  }
} & FormaElement

export const isPrivateOutdoorSpaceElement = (element?: FormaElement): element is PrivateOutdoorSpaceElement => {
  return element?.properties?.generator?.generatorId === GENERATOR_ID
}
const generate = (parameters: Parameters) => {
  const { width, depth } = parameters
  const lowerLeftParcel: Point = [-width / 2, -depth / 2]
  const lowerRightParcel: Point = [width / 2, -depth / 2]
  const upperRightParcel: Point = [width / 2, depth / 2]
  const upperLeftParcel: Point = [-width / 2, depth / 2]
  const parcelPolygon: Polygon = [lowerLeftParcel, lowerRightParcel, upperRightParcel, upperLeftParcel]
  const elementId = newId()
  const element: PrivateOutdoorSpaceElement = {
    urn: createUrn(SYSTEM, PROJECT_ID, elementId, newRevision()),
    properties: {
      generator: {
        generatorId: GENERATOR_ID,
        parameters: parameters,
      },
      privateOutdoorSpace: {
        spaces: [{ polygons: [parcelPolygon] }],
      },
      category: "privateOutdoorSpace",
    },
  }
  const terrainShape: TerrainShape = privateOutdoorSpaceToTerrainShape([{ polygons: [parcelPolygon] }], elementId)
  return { element, terrainShape }
}
export default {
  generatorId: GENERATOR_ID,
  generate,
}
