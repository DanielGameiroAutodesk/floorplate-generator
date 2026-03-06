import type { TerrainShape, TerrainShapeFeaturePropertiesWithExtensions } from "src/lib/element/types"
import type { Renderable, RenderingSpec } from "./renderable"
import type { RenderableV2 } from "src/core/preview-element-state"
import { featureAsPolygon } from "./2d-polygon"
import { DEFAULT_COLOR_2D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"
import { generateColorArray } from "src/lib/three/geometryUtils"
import type { BufferGeometry } from "three"
import { BufferAttribute, Color, Matrix4, Vector3 } from "three"
import { generateXYBasedUvArray } from "./generateXYBasedUvArray"
import { create2DLineGeoFromSegments } from "./2d-line"
import type { InternalPath } from "src/lib/element/path"
import type { Feature, LineString, Polygon } from "geojson"
import type { TerrainShapeFeatureProperties, Urn } from "@spacemakerai/element-types"
import { isDefined } from "src/lib/array"

// This type is the shared minimum between Renderable and RenderableV2
// Geometry in non-transformed in this type
export type MinimumRenderable = {
  geometry: BufferGeometry
  spec: RenderingSpec
  imgUrl?: string
}

function polygonFill(feature: Feature<Polygon, TerrainShapeFeaturePropertiesWithExtensions>): MinimumRenderable {
  const geometry = featureAsPolygon(feature).toNonIndexed()

  const color = feature.properties?.fill?.color ?? DEFAULT_COLOR_2D
  const opacity =
    feature.properties?.fill?.opacity ?? (isDefined(feature.properties?.fill?.color) ? DEFAULT_OPACITY_2D : 0)

  const imgUrl = feature.properties.fill?.imgUrl

  const colorArray = generateColorArray(new Color(color), geometry.attributes.position.count, opacity)
  // Rectangle vertices need to be axis-aligned in a local coordinate system when running generateXYBasedUvArray
  const uvArray = generateXYBasedUvArray(geometry.attributes.position)
  geometry.setAttribute("color", new BufferAttribute(colorArray, 4, true))
  geometry.setAttribute("uv", new BufferAttribute(uvArray, 2, false))
  geometry.computeBoundingSphere()

  return {
    geometry,
    spec: imgUrl ? "imageSpec" : "basicVertexColorsTransparent",
    imgUrl,
  }
}

function stroke(
  feature: Feature<Polygon | LineString, TerrainShapeFeaturePropertiesWithExtensions>,
  scale: number,
): MinimumRenderable[] {
  if (!feature.properties?.stroke?.color && !feature.properties?.stroke?.lineWidth) return []

  const lineWidth = feature.properties?.stroke?.lineWidth ?? 1
  const color = feature.properties?.stroke?.color ?? DEFAULT_COLOR_2D

  const wrappedCoordinates =
    feature.geometry.type === "Polygon" ? feature.geometry.coordinates : [feature.geometry.coordinates]

  return wrappedCoordinates.map((coordinates) => {
    // Scale all x/y coordinates by the provided scale value before building the geometry. This is
    // needed because the create2DLineGeoFromSegments method assumes global coordinates (to achieve
    // the desired sideways fade in the line shader)
    const scaledCoordinates = coordinates.map(([x, y]) => [x * scale, y * scale])
    const outlineGeometry = create2DLineGeoFromSegments(scaledCoordinates, lineWidth).toNonIndexed()
    const outlineColorArray = generateColorArray(new Color(color), outlineGeometry.attributes.position.count, 1)
    outlineGeometry.setAttribute("color", new BufferAttribute(outlineColorArray, 4, true))

    // Transform the geometry back to "unscaled" version before returning, so that the full Matrix4
    // transform can be applied in the usual fashion later
    outlineGeometry.scale(1 / scale, 1 / scale, 1 / scale)
    outlineGeometry.computeBoundingSphere()

    return {
      geometry: outlineGeometry,
      spec: feature.properties.stroke?.dashed ? "dashedTerrainLines" : "terrainLines",
    }
  })
}

function renderableFromPolygonFeature(
  feature: Feature<Polygon, TerrainShapeFeatureProperties>,
  scale: number,
): MinimumRenderable[] {
  const renderables: MinimumRenderable[] = []
  const fill = polygonFill(feature)
  const outline = stroke(feature, scale)
  if (fill) renderables.push(fill)
  renderables.push(...outline)
  return renderables
}

function renderableFromLineStringFeature(
  feature: Feature<LineString, TerrainShapeFeatureProperties>,
  scale: number,
): MinimumRenderable[] {
  return stroke(feature, scale)
}

/**
 * Returns renderable geometry for a terrainShape without transform, i.e. in local coordinates to be
 * transformed later. However, we still require the scale at which the geometry is ultimately going
 * to be transformed, because line widths in terrain shapes are defined to be in global units
 */
export function minimumRenderableFromTerrainShape(terrainShape: TerrainShape, scale: number): MinimumRenderable[] {
  return terrainShape.features.flatMap((feature): MinimumRenderable[] => {
    switch (feature.geometry.type) {
      case "LineString":
        return renderableFromLineStringFeature(feature as Feature<LineString, TerrainShapeFeatureProperties>, scale)
      case "Polygon":
        return renderableFromPolygonFeature(feature as Feature<Polygon, TerrainShapeFeatureProperties>, scale)
      case "Point":
      case "MultiPoint":
      case "MultiLineString":
      case "MultiPolygon":
      case "GeometryCollection":
        return []
    }
  })
}

export function renderableFromTerrainShape(
  terrainShape: TerrainShape,
  path: InternalPath,
  transform: Matrix4,
): Renderable[] {
  let matrix = new Matrix4()
  if (transform) {
    matrix.copy(transform)
    matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
  }

  const scale = new Vector3().setFromMatrixScale(matrix)
  const uniformScale = scale.x

  return minimumRenderableFromTerrainShape(terrainShape, uniformScale).map(({ geometry, spec, imgUrl }) => ({
    geometry: geometry.applyMatrix4(matrix),
    spec: spec,
    id: path,
    toplevel: path,
    imgUrl: imgUrl,
  }))
}

export function renderableV2FromTerrainShape(
  terrainShape: TerrainShape,
  path: InternalPath,
  urn: Urn,
): Omit<RenderableV2, "matrix">[] {
  return minimumRenderableFromTerrainShape(terrainShape, 1).map(({ geometry, spec }) => ({
    id: path,
    geometry: geometry,
    spec: spec,
    scene: "2d",
    urn,
  }))
}
