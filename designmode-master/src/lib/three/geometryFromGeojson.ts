import type { BufferGeometry } from "three"
import { Color } from "three"
import { buildGeo } from "./basic-geometry-utils"
import type { Feature } from "geojson"
import { DEFAULT_COLOR_3D } from "./defaultRenderingProperties"

export const geometryFromGeojson = (geojson: Feature): BufferGeometry | undefined => {
  if (
    geojson.geometry.type === "Polygon" &&
    geojson.properties &&
    "height" in geojson.properties &&
    "elevation" in geojson.properties
  ) {
    return buildGeo({
      elevation: geojson.properties.elevation,
      height: geojson.properties.height,
      coordinates: geojson.geometry.coordinates.map((p) => p.map((c) => [c[0], c[1]])),
      color: new Color(DEFAULT_COLOR_3D),
    })
  }
  return undefined
}
