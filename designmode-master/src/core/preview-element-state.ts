import type { Urn } from "@spacemakerai/element-types"
import { BufferAttribute, BufferGeometry, Color, Matrix4 } from "three"
import type { Feature } from "geojson"
import type { RenderingSpec } from "src/integrations/renderables/renderable"
import { getRenderingSpecForElement } from "src/integrations/renderables/renderable"
import type { InternalPath } from "src/lib/element/path"
import { expandPathSetToIncludeDescendants } from "src/lib/element/path"
import { calculateEdgesGeometry, generateColorArray } from "src/lib/three/geometryUtils"
import type { TerrainShape } from "src/lib/element/types"
import { highlightedFillSignal } from "./selection/selectionState"
import { getHighlightFillForPaths } from "src/integrations/renderables/HighlightMesh"
import { getWorldMatrix } from "src/lib/element/transform"
import { renderableV2FromTerrainShape } from "src/integrations/renderables/terrainShape"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { getInMapOrThrow } from "src/lib/map"
import { computed } from "@preact/signals"
import { explicitSignalWithReset } from "src/lib/signal"
import { assertIsDefined } from "src/lib/assertions"
import { Set_intersection } from "src/lib/set"

/**
 * This state is in place to efficiently rendered a previewed element state.
 * The previewed element state can be set via the ActionAPI.preview() function.
 *
 * There are mainly two concepts which make this code fast enough to run on mousemove:
 * 1. We only calculate renderables (opposed to toplevel state which does snappinglines, selection lines etc).
 * 2. The renderables does not have a baked transform, which makes it easier to cache on element-level
 * */
type PreviewElements = {
  rootUrn: Urn
  pathToUrn: Map<InternalPath, Urn>
  elements: FormaElementLookup
  volumeMeshes: Map<Urn, BufferGeometry>
  footprints: Map<Urn, Feature>
  terrainShapes: Map<Urn, TerrainShape>
}

/**
 * Set of paths which should be rendered by preview code instead of main rendering. Children of paths in this set
 * should also be rendered by preview rendering.
 *
 * This can contain a mix of paths that exists in old state and preview state. For instance a path might
 * be in this set to be hidden in old state but still not exist in new state.
 */
export const [previewSetSignal, setPreviewSetSignalValue, resetPreviewSetSignal] = explicitSignalWithReset<
  Set<InternalPath>
>(new Set())

export const [previewElementsSignal, setPreviewElementsSignalValue, resetPreviewElementsSignal] =
  explicitSignalWithReset<PreviewElements | undefined>(undefined)

/**
 * Calculates renderables based on a "diff" between real element state and the temporary state.
 * */
export const previewRenderablesSignal = computed<RenderableV2[]>(() => {
  const preview = previewElementsSignal.value
  if (!preview) return []

  const diff = previewSetSignal.value
  return getRenderables(
    preview.rootUrn,
    preview.elements,
    preview.volumeMeshes,
    preview.footprints,
    preview.terrainShapes,
    preview.pathToUrn,
    Set_intersection(diff, new Set(preview.pathToUrn.keys())),
  )
})

export const previewHighlightFillSignal = computed(() => {
  const preview = previewElementsSignal.value
  if (!preview) return []
  const highlightFill = highlightedFillSignal.value
  const previewFilter = previewSetSignal.value
  return getHighlightFillForPaths(
    Set_intersection(highlightFill, new Set(preview.pathToUrn.keys())),
    preview.rootUrn,
    preview.elements,
    preview.volumeMeshes,
    preview.pathToUrn,
    {
      include: previewFilter,
    },
  )
})

export type RenderableV2 = {
  scene: "3d" | "2d"
  id: string // Only here to make it compatible
  urn: Urn
  geometry: BufferGeometry
  spec: RenderingSpec
  matrix: Matrix4
}

const cache: Map<Urn, Omit<RenderableV2, "matrix">[]> = new Map()

export function getRenderables(
  rootUrn: Urn,
  elements: FormaElementLookup,
  volumeMeshes: Map<Urn, BufferGeometry>,
  footprints: Map<Urn, Feature>,
  terrainShapes: Map<Urn, TerrainShape>,
  pathToUrn: Map<InternalPath, Urn>,
  pathsToRender: Set<InternalPath>,
): RenderableV2[] {
  const renderables: RenderableV2[] = []

  const pathsToRenderExpanded = expandPathSetToIncludeDescendants(pathsToRender, new Set(pathToUrn.keys()))
  pathsToRenderExpanded.forEach((path) => {
    const urn = assertIsDefined("Path should exist", pathToUrn.get(path))
    const element = elements.get(urn)
    if (!element) return
    if (!cache.has(urn)) {
      const renderables3d = getRenderables3dForElement(urn, path, elements, volumeMeshes)
      const renderables2d = getRenderables2dForElement(urn, path, terrainShapes)
      cache.set(urn, [...renderables2d, ...renderables3d])
    }
    const matrix = getWorldMatrix(path, rootUrn, elements)
    renderables.push(...getInMapOrThrow(cache, urn).map((r) => ({ ...r, matrix: matrix || new Matrix4() })))
  })

  return renderables
}

function getRenderables3dForElement(
  urn: Urn,
  path: InternalPath,
  elements: FormaElementLookup,
  volumeMeshes: Map<Urn, BufferGeometry>,
) {
  const element = elements.getOrThrow(urn)
  const geometry = volumeMeshes.get(urn)
  const renderablesForElement: Omit<RenderableV2, "matrix">[] = []
  if (geometry) {
    if (element.properties?.color && typeof element.properties.color === "string") {
      const color = generateColorArray(new Color(element.properties.color), geometry.attributes.position.count)
      geometry.setAttribute("color", new BufferAttribute(color, 3, true))
    }
    renderablesForElement.push({
      scene: "3d",
      id: path,
      urn,
      geometry: geometry,
      spec: getRenderingSpecForElement(geometry, element),
    })

    const outlines = calculateEdgesGeometry(geometry)
    if (outlines) {
      const outlinegeo = new BufferGeometry()
      outlinegeo.setAttribute("position", new BufferAttribute(outlines, 3))
      renderablesForElement.push({
        scene: "3d",
        id: path,
        urn,
        geometry: outlinegeo,
        spec: "basicLines",
      })
    }
  }
  return renderablesForElement
}

function getRenderables2dForElement(
  urn: Urn,
  path: InternalPath,
  terrainShapes: Map<Urn, TerrainShape>,
): Omit<RenderableV2, "matrix">[] {
  const terrainShape = terrainShapes.get(urn)
  if (!terrainShape) return []

  return renderableV2FromTerrainShape(terrainShape, path, urn)
}
