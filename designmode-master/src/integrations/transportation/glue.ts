import type { EmbeddedJsonRepresentation, FormaElement, JsonRepresentations } from "@spacemakerai/element-types"
import transportationApi, { roadColor, type TransportationElement } from "./lib/transportationApi"
import { ElementContainer } from "src/core/elements/ElementContainer"
import type { Renderable } from "src/integrations/renderables/renderable"
import type { Feature } from "geojson"
import { buildRenderablesFromGeojson } from "src/integrations/renderables/buildRenderablesFromGeojson"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { getOutlinesFromTerrainShape } from "src/core/selection/terrain-shape-outlines"
import type { TerrainShape } from "src/lib/element/types"
import type { Matrix4 } from "three"
import { propertyPresets } from "src/integrations/draw/DrawAPI"
import { DEFAULT_COLOR_2D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"

export function createElementContainer(element: TransportationElement) {
  const terrainShapeJson = element.representations!.terrainShape as EmbeddedJsonRepresentation<
    JsonRepresentations["terrainShape"]
  >
  const terrainShape = terrainShapeJson.data

  const footprintJson = element.representations!.footprint as EmbeddedJsonRepresentation<
    JsonRepresentations["footprint"]
  >
  const footprintFeature = footprintJson.data.features[0]
  return ElementContainer.fromDraftElement(element, undefined, {
    terrainShape,
    footprint: footprintFeature,
    terrainTexture: undefined,
    volumeMesh: undefined,
    buildingFloors3DSketch_UNSTABLE: undefined,
  })
}

export function generateOutlines2d(
  element: FormaElement,
  globalMatrix: Matrix4,
  terrainSamplerData: TerrainSamplerData,
) {
  if (!transportationApi.isTransportationElement(element)) throw new Error("Element is not transportation element")
  const lineString = transportationApi.generateCenterLine(element)
  const terrainShape: TerrainShape = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: lineString }],
  }
  //TODO decide if ok to use this function?
  return getOutlinesFromTerrainShape(terrainShape, globalMatrix, terrainSamplerData)
}

export const polygonsToRenderables = (polygons: [number, number][][]): Renderable[] => {
  const renderables = polygons.flatMap((polygon) => {
    const feature: Feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [polygon],
      },
      properties: {
        fill: { color: roadColor, opacity: 1 },
      },
    }
    return buildRenderablesFromGeojson(feature, "road", undefined, roadColor, 1, "some-id", undefined, false, {})
  })
  return renderables
}

export const lineStringToRailRenderables = (lineString: [number, number][], lineWidth: number): Renderable[] => {
  const railColor = propertyPresets.rails.color ?? DEFAULT_COLOR_2D
  const railOpacity = propertyPresets.rails.opacity ?? DEFAULT_OPACITY_2D
  const feature: Feature = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: lineString,
    },
    properties: {
      lineWidth,
    },
  }
  return buildRenderablesFromGeojson(
    feature,
    "rails",
    undefined,
    railColor,
    railOpacity,
    "some-id-rail",
    undefined,
    false,
    propertyPresets.rails,
  )
}
