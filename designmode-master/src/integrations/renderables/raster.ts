import type { Renderable, RenderingSpec } from "./renderable"
import { create2DPolygon } from "./2d-polygon"
import { DEFAULT_COLOR_2D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"
import { generateColorArray } from "src/lib/three/geometryUtils"
import type { BufferGeometry } from "three"
import { BufferAttribute, Color, Matrix4 } from "three"
import { isDefined } from "src/lib/array"
import type { TerrainTexture } from "src/core/elements-loading/loading"
import type { InternalPath } from "src/lib/element/path"

type MinimumRenderable = {
  geometry: BufferGeometry
  spec: RenderingSpec
  imgUrl?: string
}

const blobCache = new Map<string, string>()

function polygonFill(terrainTexture: TerrainTexture): MinimumRenderable {
  const geometry = create2DPolygon(terrainTexture.properties.boundingBox).toNonIndexed()
  const color = terrainTexture.properties.color ?? DEFAULT_COLOR_2D
  const opacity =
    terrainTexture.properties.opacity ?? (isDefined(terrainTexture.properties.color) ? DEFAULT_OPACITY_2D : 0)
  const colorArray = generateColorArray(new Color(color), geometry.attributes.position.count, opacity)

  //assumes bbox is rectangular and on the form [lowerLeft, lowerRight, upperRight, upperLeft]
  const uvArray = Float32Array.from([0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1])

  geometry.setAttribute("color", new BufferAttribute(colorArray, 4, true))
  geometry.setAttribute("uv", new BufferAttribute(uvArray, 2, false))
  geometry.computeBoundingSphere()
  const cachedBlob = blobCache.get(terrainTexture.cacheKey)
  if (cachedBlob) {
    return {
      geometry,
      spec: "imageSpec",
      imgUrl: cachedBlob,
    }
  }
  const blob = new Blob([terrainTexture.image], { type: terrainTexture.properties.mimeType })
  const imgUrl = URL.createObjectURL(blob)
  blobCache.set(terrainTexture.cacheKey, imgUrl)
  return {
    geometry,
    spec: "imageSpec",
    imgUrl,
  }
}

export function renderableFromTerrainTexture(
  terrainTexture: TerrainTexture,
  path: InternalPath,
  transform: Matrix4,
): Renderable[] {
  let matrix = new Matrix4()
  if (transform) {
    matrix.copy(transform)
    matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
  }

  return minimumRenderableFromTerrainTexture(terrainTexture).map(({ geometry, spec, imgUrl }) => ({
    geometry: geometry.applyMatrix4(matrix),
    spec: spec,
    id: path,
    toplevel: path,
    imgUrl: imgUrl,
  }))
}

export function minimumRenderableFromTerrainTexture(terrainTexture: TerrainTexture): MinimumRenderable[] {
  const renderables: MinimumRenderable[] = []
  const fill = polygonFill(terrainTexture)
  if (fill) renderables.push(fill)
  return renderables
}
