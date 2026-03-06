import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { Matrix4, Mesh } from "three"
import { atom } from "recoil"
import type { RawTerrainData } from "src/core/terrain/terrain-download"
import type { TerrainElement } from "src/core/terrain/terrain-types"
import type { InternalPath } from "src/lib/element/path"
import type { Category } from "src/core/categories"
import type { Renderable } from "src/integrations/renderables/renderable"
import type { RaycastData, RaycastObject } from "src/core/selection/raycasting"
import type { SnapInfo } from "src/integrations/snapping/snapping"
import type { FormaElementLookup } from "src/lib/element/lookup"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"

export type LibrarySelectionOutline = { fullpath: InternalPath; position: Float32Array }

export type LibraryElementInfo = {
  path: InternalPath
  urn: Urn
  element: FormaElement
  category: Category
  locked: boolean
  hidden: boolean
  scenario: boolean
  worldTransform: Matrix4 | undefined
  geometry: {
    renderables2d: Renderable[]
    renderables3d?: Renderable[]
    selectionOutlines: LibrarySelectionOutline[]
    raycastTargets: RaycastObject<Mesh, RaycastData>[]
    snapping?: SnapInfo
  }
}

export type LibraryElementData = {
  toplevel: LibraryElementInfo[]
  name?: string
  state: {
    rootUrn: Urn
    elements: FormaElementLookup
    representations: RepresentationsByUrn
  }
}

export type LibraryTerrainElement = {
  element: TerrainElement
  terrainData: RawTerrainData
  previewMesh: Mesh
}

export const libraryTerrainElementState = atom<LibraryTerrainElement | undefined>({
  key: "library-terrain-element-state",
  default: undefined,
  dangerouslyAllowMutability: true,
})

export const libraryElementsState = atom<LibraryElementData | undefined>({
  key: "library-elements-state",
  default: undefined,
  dangerouslyAllowMutability: true,
})
