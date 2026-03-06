import type { BufferGeometry, Material, Matrix4 } from "three"
import { BufferAttribute, Color, DoubleSide, LineBasicMaterial, MeshBasicMaterial, MeshLambertMaterial } from "three"
import { WSRMeshLambertMaterial } from "@spacemakerai/web-sketch-renderer"
import { lineshader, lineshaderWithColor } from "./2d-line"
import type { FormaElement, Urn } from "@spacemakerai/element-types"

import type { InternalPath } from "src/lib/element/path"

type BufferSpec = {
  name: string
  size: number
  type: typeof Float32Array | typeof Uint8Array // non-exhaustive right now
  normalized?: boolean
}

type RenderingSpecDescriptor = {
  material: {
    normal: Material
    faint: Material
    placeModeSelected?: Material
    placeMode?: Material
  }
  castShadow?: boolean
  receiveShadow?: boolean
  drawMode?: "Triangle" | "LineSegments"
  renderOrder?: number
  buffers: BufferSpec[]
  shouldHaveIndex: boolean
}

const positionBufferSpec = { name: "position", size: 3, type: Float32Array }
const rgbColorBufferSpec = { name: "color", size: 3, type: Uint8Array, normalized: true }
const rgbaColorBufferSpec = { name: "color", size: 4, type: Uint8Array, normalized: true }
const normalBufferSpec = { name: "normal", size: 3, type: Float32Array }
const uvBufferSpec = { name: "uv", size: 2, type: Float32Array }

// terrain lines buffer specs
const distanceAlongLineBufferSpec = { name: "distanceAlongLine", size: 1, type: Float32Array }
const distanceToCenterBufferSpec = { name: "distanceToCenter", size: 1, type: Float32Array }
const widthBufferSpec = { name: "width", size: 1, type: Float32Array }
const terrainLineBufferSpecs = [
  positionBufferSpec,
  rgbaColorBufferSpec,
  distanceAlongLineBufferSpec,
  distanceToCenterBufferSpec,
  widthBufferSpec,
]

const vertexColors: RenderingSpecDescriptor = {
  material: {
    // This uses the WSRMeshLambertMaterial because it has backface diagnostics (renders backfaces as pink.)
    // Otherwise the material is the same as the standard MeshLambertMaterial. This does use onBeforeCompile
    // to inject shader code, so if something breaks upgrading threeJS that may be the culprit.
    normal: new MeshLambertMaterial({ side: DoubleSide, vertexColors: true }),
    faint: new MeshLambertMaterial({
      color: 0xbbbbbb,
      polygonOffset: true,
      polygonOffsetUnits: 0.5,
      polygonOffsetFactor: 0.5,
      side: DoubleSide,
    }),
    placeMode: new MeshLambertMaterial({ transparent: true, opacity: 0.5 }),
  },
  castShadow: true,
  receiveShadow: true,
  buffers: [positionBufferSpec, rgbColorBufferSpec, normalBufferSpec],
  shouldHaveIndex: true,
}

export const RenderingSpecs = {
  // -------------------------------------------------
  // Materials used for rendering in the main 3D scene
  // -------------------------------------------------

  i3ds: {
    material: {
      // This uses the WSRMeshLambertMaterial because it has backface diagnostics (renders backfaces as pink.)
      // Otherwise the material is the same as the standard MeshLambertMaterial. This does use onBeforeCompile
      // to inject shader code, so if something breaks upgrading threeJS that may be the culprit.
      normal: new WSRMeshLambertMaterial({
        side: DoubleSide,
        vertexColors: true,
        defines: { BACKFACE_DIAGNOSTICS: 1 },
      }),
      faint: new MeshLambertMaterial({
        color: 0xbbbbbb,
        polygonOffset: true,
        polygonOffsetUnits: 0.5,
        polygonOffsetFactor: 0.5,
        side: DoubleSide,
        vertexColors: true,
      }),
      placeMode: new MeshLambertMaterial({ transparent: true, opacity: 0.5 }),
    },
    castShadow: true,
    receiveShadow: true,
    buffers: [positionBufferSpec, rgbColorBufferSpec, normalBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,
  vertexColors,
  vertexColorsTransparent: {
    ...vertexColors,
    material: { ...vertexColors.material, normal: new MeshLambertMaterial({ vertexColors: true, transparent: true }) },
    buffers: [positionBufferSpec, rgbaColorBufferSpec, normalBufferSpec],
  } as RenderingSpecDescriptor,
  constraintFace: {
    material: {
      normal: new MeshLambertMaterial({
        color: "#8d4771",
        depthWrite: false,
        transparent: true,
        opacity: 0.2,
        polygonOffset: true,
        polygonOffsetUnits: -0.3,
        polygonOffsetFactor: -0.3,
      }),
      faint: new MeshLambertMaterial({
        color: "#8d4771",
        depthWrite: false,
        transparent: true,
        opacity: 0.2,
        polygonOffset: true,
        polygonOffsetUnits: -0.3,
        polygonOffsetFactor: -0.3,
      }),
    },
    castShadow: false,
    receiveShadow: false,
    renderOrder: 1,
    buffers: [positionBufferSpec, rgbColorBufferSpec, normalBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,
  previewDeletion: {
    material: {
      normal: new MeshLambertMaterial({
        color: "#cccccc",
        transparent: true,
        opacity: 0.3,
        polygonOffset: true,
        polygonOffsetUnits: -0.3,
        polygonOffsetFactor: -0.3,
      }),
      faint: new MeshBasicMaterial({
        visible: false,
      }),
    },
    castShadow: false,
    receiveShadow: false,
    buffers: [positionBufferSpec, normalBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,
  constraintOutline: {
    material: {
      normal: new LineBasicMaterial({
        polygonOffset: true,
        polygonOffsetUnits: -0.5,
        polygonOffsetFactor: -0.5,
        color: "#8d4771",
      }),
      faint: new LineBasicMaterial({
        polygonOffset: true,
        polygonOffsetUnits: -0.5,
        polygonOffsetFactor: -0.5,
        color: "#a18294",
      }),
    },
    renderOrder: -1,
    drawMode: "LineSegments",
    buffers: [positionBufferSpec],
    shouldHaveIndex: false,
  } as RenderingSpecDescriptor,
  vertexColorsDoubleSided: {
    material: {
      normal: new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }),
      faint: new MeshLambertMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity: 0.2 }),
    },
    castShadow: true,
    receiveShadow: true,
    buffers: [positionBufferSpec, rgbColorBufferSpec, normalBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,
  basicLines: {
    material: {
      normal: new LineBasicMaterial({
        polygonOffset: true,
        polygonOffsetUnits: -0.5,
        polygonOffsetFactor: -0.5,
        color: "#555555",
      }),
      faint: new LineBasicMaterial({
        visible: true,
        polygonOffset: true,
        polygonOffsetUnits: -0.5,
        polygonOffsetFactor: -0.5,
        color: 0x666666,
        opacity: 0.7,
        transparent: true,
      }),
      placeMode: new LineBasicMaterial({
        polygonOffset: true,
        polygonOffsetUnits: -0.5,
        polygonOffsetFactor: -0.5,
        color: "white",
        opacity: 1,
      }),
    },
    drawMode: "LineSegments",
    buffers: [positionBufferSpec],
    shouldHaveIndex: false,
  } as RenderingSpecDescriptor,
  sectionBoxOutline: {
    material: {
      normal: new LineBasicMaterial({
        color: "#000000",
      }),
      faint: new LineBasicMaterial({
        color: "#0096FF",
      }),
    },
    renderOrder: -1,
    drawMode: "LineSegments",
    buffers: [positionBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,
  sectionTerrainMesh: {
    material: {
      normal: new MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.2,
        vertexColors: true,
        side: DoubleSide,
      }),
      faint: new MeshBasicMaterial({ transparent: false, opacity: 0.2, vertexColors: true }),
    },
    buffers: [positionBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,

  // ----------------------------------------------------
  // Materials used for rendering in the 2D overlay scene
  // ----------------------------------------------------

  // Because we merge together meshes of the same material, we lose control over the render order of
  // 2D elements. Ideally we'd like users to have complete control over how 2D shapes layer on top
  // of each other, but for now we have a stopgap solution in always enforcing the following order:
  //
  // (1) Reference images, (2) dashed stroke lines, (3) filled polygons, (4) normal stroke lines
  //
  // Finally, we want all other 2D geometry on top of these, such as rapid analysis overlays.
  //
  // This works ok for the common case of having satellite imagery as the bottom-most layer, then
  // some property boundaries (dashed) that shouldn't be too prominent in the scene, then filled
  // polygons (roads, generic surfaces) and finally strokes (surface outlines, imported DXF lines)
  // on top as the most important 2D shapes.

  // Filled polygons (e.g. from terrainShapes)
  basicVertexColorsTransparent: {
    material: {
      normal: new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
      }),
      faint: new MeshBasicMaterial({ vertexColors: true, transparent: true }),
      placeMode: new MeshBasicMaterial({ transparent: true, opacity: 0.5 }),
    },
    renderOrder: -2,
    buffers: [positionBufferSpec, rgbaColorBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,

  // Reference images
  imageSpec: {
    material: {
      normal: new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
      }),
      faint: new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 }),
      placeMode: new MeshBasicMaterial({ transparent: true, opacity: 0.5 }),
    },
    renderOrder: -4,
    buffers: [positionBufferSpec, rgbaColorBufferSpec, uvBufferSpec],
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,

  // Stroke lines (e.g. from terrainShapes)
  terrainLines: {
    material: {
      normal: lineshader(false),
      faint: lineshaderWithColor(false, true, new Color(0x555555)),
      placeMode: lineshaderWithColor(false, false, new Color(0xffffff), 0.5),
    },
    renderOrder: -1,
    buffers: terrainLineBufferSpecs,
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,

  // Dashed stroke lines (e.g. from terrainShapes)
  dashedTerrainLines: {
    material: {
      normal: lineshader(true),
      faint: lineshader(true, true),
      placeMode: lineshaderWithColor(true, false, new Color(0xffffff)),
      placeModeSelected: lineshaderWithColor(true, false, new Color(0x0080ba)),
    },
    renderOrder: -3,
    buffers: terrainLineBufferSpecs,
    shouldHaveIndex: true,
  } as RenderingSpecDescriptor,
} as const

Object.entries(RenderingSpecs).forEach(([key, desc]) => {
  desc.material["normal"].name = `${key}-material`
  desc.material["faint"].name = `${key}-material-faint`

  if (desc.material.placeModeSelected) desc.material.placeModeSelected.name = `${key}-material-placeModeSelected`
  if (desc.material.placeMode) desc.material.placeMode.name = `${key}-material-placeMode`
})

export type RenderingSpec = keyof typeof RenderingSpecs
export type RenderingMode = keyof (typeof RenderingSpecs)[RenderingSpec]["material"]

export type Renderable = {
  id: InternalPath
  /** @deprecated Should be removed. Also not actually toplevel in most of the code, but specific path */
  toplevel?: InternalPath
  geometry: BufferGeometry
  spec: RenderingSpec
  mode?: RenderingMode
  urn?: Urn
  imgUrl?: string
}

export function getRenderingSpecForElement(
  geometry: BufferGeometry,
  element: Pick<FormaElement, "properties" | "children" | "representations">,
): RenderingSpec {
  if (element.properties?.category === "constraints") {
    return "constraintFace"
  } else if (
    element.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm") ||
    element.representations?.axm
  ) {
    return "i3ds"
  } else if (geometry.userData?.doubleSided) {
    return "vertexColorsDoubleSided"
  }
  const colors = geometry.getAttribute("color")?.itemSize
  return colors === 4 ? "vertexColorsTransparent" : "vertexColors"
}

/*
 * Minimal renderable type for the new rendering pipeline utilizing BatchedMesh.
 * RenderableGeometry represents a BufferGeometry (and an associated/implied RenderingSpec) that can
 * potentially be reused by multiple elements. In other words, this object will typically belong to
 * an ElementContainer/URN, with the geometry in _untransformed_ coordinates.
 */

export type Renderable3DGeometry = {
  type: "3d"
  geometry: BufferGeometry
  renderingSpec: RenderingSpec
}
export type RenderableGeometry = Renderable3DGeometry

/*
 * Wraps a RenderableGeometry with a transform so we can place an instance of the geometry in the
 * scene. This is typically produced by a ChildNodeContainer.
 */

export type RenderableInstanceInformation = {
  transform: Matrix4
  renderingMode?: RenderingMode
}
export type Renderable3DInstance = Renderable3DGeometry & RenderableInstanceInformation
export type RenderableInstance = Renderable3DInstance

const geometryColorOverridesCache: WeakMap<BufferGeometry, Map<string, BufferGeometry>> = new WeakMap()

/**
 * Clones the geometry of a Renderable and replaces the color array with a uniform color override.
 * Includes an internal cache (based on WeakMap keyed on the original BufferGeometry object
 * reference), so repeated calls to this method are cheap.
 */
export function overrideColorInRenderable<R extends Renderable3DGeometry>(uncolored: R, colorOverride: Uint8Array): R {
  if (!colorOverride || !uncolored.geometry.attributes.color) return uncolored
  if (colorOverride.length === 4 && colorOverride[3] === 255) {
    // don't render opaque meshes as transparent
    colorOverride = colorOverride.slice(0, 3)
  }
  const transparent = colorOverride.length === 4

  if (!geometryColorOverridesCache.has(uncolored.geometry)) {
    geometryColorOverridesCache.set(uncolored.geometry, new Map())
  }
  const overrideCacheForGeometry = geometryColorOverridesCache.get(uncolored.geometry)!
  const cacheKey = colorOverride.toString()

  if (!overrideCacheForGeometry.has(cacheKey)) {
    const itemSize = transparent ? 4 : 3
    const coloredGeometry = uncolored.geometry.clone()
    const vertices = coloredGeometry.getAttribute("position").count
    const colorArray = new Uint8Array(vertices * itemSize)
    for (let i = 0; i < colorArray.length; i += itemSize) {
      colorArray.set(colorOverride, i)
    }
    coloredGeometry.setAttribute("color", new BufferAttribute(colorArray, itemSize, true))
    overrideCacheForGeometry.set(cacheKey, coloredGeometry)
  }

  return {
    ...uncolored,
    geometry: overrideCacheForGeometry.get(cacheKey)!,
    renderingSpec: transparent ? "vertexColorsTransparent" : "vertexColors",
  }
}
