import { BufferAttribute, Color, Matrix4, Vector3 } from "three"
import { featureAsOutline, featureAsPolygon } from "./2d-polygon"
import type { Properties } from "@spacemakerai/element-types"
import type { Feature, Polygon } from "geojson"
import type { Renderable } from "./renderable"
import type { BasicLine } from "src/lib/geometry/geometryTypes"
import { create2DLineGeoFromSegments } from "./2d-line"
import { generateColorArray } from "src/lib/three/geometryUtils"
import type { RenderingProperties } from "src/lib/three/defaultRenderingProperties"
import { getDefaultRenderingPropertiesByCategory } from "src/lib/three/defaultRenderingProperties"
import { categoryToDefaultLineWidth } from "src/lib/three/Shape/shapeUtils"
import { generateXYBasedUvArray } from "./generateXYBasedUvArray"

const reusableVecForApplyingMatrixToPoint = new Vector3()

function isBasicLine(feature: Feature): feature is BasicLine {
  return feature.geometry.type === "LineString"
}

function isPolygonFeature<P>(feature: Feature<any, P>): feature is Feature<Polygon, P> {
  return feature.geometry.type === "Polygon"
}

export function buildRenderablesFromGeojson(
  shape: Feature,
  category: string | undefined,
  transform: Matrix4 | undefined,
  colorHex: string,
  opacity: number,
  id: string,
  toplevel: string | undefined,
  isImperial: boolean,
  elementProperties?: Properties,
): Renderable[] {
  if (isPolygonFeature(shape)) {
    const geometry = featureAsPolygon(shape).toNonIndexed()
    geometry.name = id
    const color = new Color(colorHex)
    const colorArray = generateColorArray(color, geometry.attributes.position.count, opacity)
    const uvArray = generateXYBasedUvArray(geometry.attributes.position)
    geometry.setAttribute("color", new BufferAttribute(colorArray, 4, true))
    geometry.setAttribute("uv", new BufferAttribute(uvArray, 2, false))
    geometry.computeBoundingSphere()
    const isReferenceImage = category === "reference_image"
    const polygonRenderable = {
      id,
      toplevel,
      geometry,
      spec: isReferenceImage ? "imageSpec" : "basicVertexColorsTransparent",
      imgUrl: isReferenceImage ? elementProperties?.referenceImageLink.url : undefined,
    } as Renderable

    let matrix = new Matrix4()
    if (transform) {
      matrix.copy(transform)
      matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
      geometry.applyMatrix4(matrix)
    }

    // outline renderable
    const stroke: RenderingProperties["stroke"] | undefined =
      elementProperties?.stroke ?? getDefaultRenderingPropertiesByCategory(category, false)?.stroke

    if (!stroke) return [polygonRenderable]

    const outlineShape = {
      ...shape,
      geometry: {
        ...shape.geometry,
        type: "LineString",
        coordinates: shape.geometry.coordinates[0],
      },
    } as BasicLine

    const outlineGeometry = featureAsOutline(outlineShape, isImperial, category).toNonIndexed()
    const outlineColorArray = generateColorArray(new Color(stroke.color), outlineGeometry.attributes.position.count, 1)
    outlineGeometry.setAttribute("color", new BufferAttribute(outlineColorArray, 4, true))
    outlineGeometry.computeBoundingSphere()
    const outlineRenderable = {
      id,
      toplevel: toplevel,
      geometry: outlineGeometry,
      spec: stroke.dashed ? "dashedTerrainLines" : "terrainLines",
    } as Renderable

    if (transform) {
      outlineGeometry.applyMatrix4(matrix)
    }

    return [outlineRenderable, polygonRenderable]
  } else if (isBasicLine(shape)) {
    let xypairs: number[][] = []
    let matrix: Matrix4 | undefined
    if (transform) {
      matrix = new Matrix4()
      matrix.copy(transform)
      matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
    }

    for (let [x, y] of shape.geometry?.coordinates ?? []) {
      if (matrix) {
        reusableVecForApplyingMatrixToPoint.set(x, y, 0)
        reusableVecForApplyingMatrixToPoint.applyMatrix4(matrix)
        xypairs.push([reusableVecForApplyingMatrixToPoint.x, reusableVecForApplyingMatrixToPoint.y])
      } else {
        xypairs.push([x, y])
      }
    }

    const lineWidth = shape.properties?.lineWidth || categoryToDefaultLineWidth(isImperial, category)
    const geometry = create2DLineGeoFromSegments(xypairs, lineWidth).toNonIndexed()

    const dashed = !!elementProperties?.stroke?.dashed
    const color = new Color(colorHex)
    const colorArray = generateColorArray(color, geometry.attributes.position.count, opacity)
    geometry.setAttribute("color", new BufferAttribute(colorArray, 4, true))
    geometry.computeBoundingSphere()
    return [{ id: id, toplevel: toplevel, geometry, spec: dashed ? "dashedTerrainLines" : "terrainLines" }]
  }
  return []
}
