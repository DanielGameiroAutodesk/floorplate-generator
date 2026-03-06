import type { FormaElement } from "@spacemakerai/element-types"
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString, Polygon } from "geojson"
import { useEffect, useLayoutEffect, useState } from "preact/hooks"
import type { Object3D } from "three"
import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Mesh, MeshLambertMaterial } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { HiddenPaths } from "src/core/hidden"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { colors } from "src/lib/colors"
import { buildRenderablesFromGeojson } from "src/integrations/renderables/buildRenderablesFromGeojson"
import { groupFrom2dRenderables } from "src/integrations/renderables/groupFrom2dRenderables"
import type { Renderable } from "src/integrations/renderables/renderable"
import type { ElementAndPath } from "./GeneratorAdapter"
import { getObjectTransformOnTerrain } from "./terrain"
import { useIsImperial } from "src/lib/unitSettings"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type SupportedGeometry = LineString | Polygon
type SupportedFeatureCollection = FeatureCollection<SupportedGeometry, GeoJsonProperties>
type PreviewMesh = { faces: number[]; verts: number[]; doubleSided?: boolean }
type PreviewGlb = { data: ArrayBuffer }

export type PreviewRequest = {
  properties?: FormaElement["properties"] | undefined
  geojson?: SupportedFeatureCollection | undefined
  mesh?: PreviewMesh | undefined
  glb?: PreviewGlb | undefined
}

// The properties used in internal GeoJSON types already
// seem to be custom, while we'd like to expose what's documented as
// simplestyle: https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0
//
// This implementation is coupled to how buildRenderablesFromGeojson method works.
export function simplestyleToInternalFormat(feature: Feature<Geometry>): [Feature<Geometry>, Record<string, any>] {
  switch (feature.geometry.type) {
    case "Polygon": {
      const stroke = feature.properties?.stroke
        ? {
            color: feature.properties?.stroke,
            dashed: false,
          }
        : undefined

      return [
        {
          ...feature,
          properties: {
            ...feature.properties,
            lineWidth: feature.properties?.["stroke-width"] ?? 1,
          },
        },
        {
          stroke,
          color: feature.properties?.fill,
          opacity: feature.properties?.["fill-opacity"],
        },
      ]
    }
    case "LineString":
      return [
        {
          ...feature,
          properties: {
            ...feature.properties,
            lineWidth: feature.properties?.["stroke-width"] ?? 1,
          },
        },
        {
          color: feature.properties?.stroke,
          // Opacity not supported in buildRenderablesFromGeojson.
          // opacity: feature.properties?.["stroke-opacity"],
        },
      ]
    default:
      return [feature, {}]
  }
}

export function generatorResultToRenderable(
  result: PreviewRequest,
  transform: Matrix4,
  isImperial: boolean = false,
): Object3D | undefined {
  // TODO: Do we need Selection outline

  if (!result.geojson) {
    return undefined
  }

  let renderables: Renderable[] = [...(result.geojson?.features ?? [])]
    // In GeoJSON (e.g. geojson.io) the last item is rendered on top.
    // In the element system/designmode rendering the first item is rendered on top.
    .reverse()
    .flatMap((feature, i) => {
      const [internalFeature, internalProperties] = simplestyleToInternalFormat(feature)
      return buildRenderablesFromGeojson(
        internalFeature,
        undefined,
        transform,
        internalProperties.color ?? "#555555",
        internalProperties.opacity ?? 0.5,
        `GeneratorResult/${i}`,
        undefined,
        isImperial,
        internalProperties,
      )
    })
  const polygonGroup = groupFrom2dRenderables(renderables)
  polygonGroup.position.setZ(1)

  return polygonGroup
}

const PREVIEW_SINGLE_SIDE = new MeshLambertMaterial({
  color: colors.gray90,
})

const PREVIEW_DOUBLE_SIDE = new MeshLambertMaterial({
  color: colors.gray90,
  side: DoubleSide,
})

async function glbRenderable(result: NonNullable<PreviewRequest["glb"]>) {
  const gltf = await new GLTFLoader().parseAsync(result.data, "")
  const object = gltf.scene

  // Rotate x,y,z to x,-z,y
  object.matrixAutoUpdate = false

  /* prettier-ignore */
  object.matrix.set(
    1, 0, 0, 0,
    0, 0, -1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1
  );

  return object
}

function meshRenderable(result: NonNullable<PreviewRequest["mesh"]>) {
  const geometry = new BufferGeometry()
  const verts = result.verts instanceof Float32Array ? result.verts : new Float32Array(result.verts)
  geometry.setAttribute("position", new BufferAttribute(verts, 3))
  if (result.faces) {
    geometry.setIndex(Array.from(result.faces))
  }
  geometry.computeVertexNormals()

  return new Mesh(geometry, result.doubleSided ? PREVIEW_DOUBLE_SIDE : PREVIEW_SINGLE_SIDE)
}

async function generatorResultToRenderable3D(
  result: PreviewRequest,
  transform: Matrix4,
  getElevation: (x: number, y: number) => number,
): Promise<Object3D | undefined> {
  let object3d: Object3D

  if (result.glb) {
    object3d = await glbRenderable(result.glb)
  } else if (result.mesh) {
    object3d = meshRenderable(result.mesh)
  } else {
    return
  }

  if (transform.equals(new Matrix4())) {
    const terrainTransform = getObjectTransformOnTerrain(object3d, getElevation)
    if (terrainTransform) {
      object3d.applyMatrix4(terrainTransform)
    }
  } else {
    object3d.applyMatrix4(transform)
  }

  return object3d
}

function useHideRenderable(id: string | undefined, hide: boolean) {
  useLayoutEffect(() => {
    if (hide && id) {
      HiddenPaths.setPathHidden(id, true)
    } else {
      HiddenPaths.resetHiddenPaths()
    }
    return () => {
      HiddenPaths.resetHiddenPaths()
    }
  }, [hide, id])
}

export function usePreview(elementAndPath: ElementAndPath | undefined, transform: Matrix4) {
  const [previewState2D, setPreviewState2D] = useState<Object3D>()
  const [previewState3D, setPreviewState3D] = useState<Object3D>()
  useObjectLifecycle(previewState2D, true, sceneManager.overlay.scene)
  useObjectLifecycle(previewState3D, true, sceneManager.scene)

  useHideRenderable(elementAndPath?.path, !!previewState2D || !!previewState3D)

  const [preview, setPreview] = useState<PreviewRequest>()
  const { terrainSamplerData, elevationAt } = terrainSignal.value
  const isImperial = useIsImperial()

  useEffect(() => {
    let isLatest = true

    if (preview) {
      setPreviewState2D(generatorResultToRenderable(preview, transform, isImperial))
      void generatorResultToRenderable3D(preview, transform, elevationAt).then((value) => {
        if (isLatest) {
          setPreviewState3D(value)
        }
      })
    } else {
      setPreviewState2D(undefined)
      setPreviewState3D(undefined)
    }

    return () => {
      isLatest = false
    }
  }, [transform, isImperial, terrainSamplerData, preview, elevationAt])

  return (value: PreviewRequest | undefined) => {
    setPreview(value)
  }
}
