import type { InternalPath } from "src/lib/element/path"
import type { FormaElement, Transform, Urn, Volume25D } from "@spacemakerai/element-types"
import type { VolumeMesh } from "src/core/volume-mesh"
import type { Feature } from "geojson"

// The geometry data for a floor - its transform and 25D volume.
export type FloorData = {
  volume: Volume25D
  transform?: Transform
}

export type SideEffectData = {
  element: FormaElement
  worldTransform: Transform
  volumeMesh: VolumeMesh | undefined

  geoJSON?: Feature
  floorDataArray?: FloorData[]
  childTransform?: Transform // Set on imported integrate elements for scale and changing z up.
  forBrep?: boolean // True when the synced mesh will be immediately converted to a brep for edit.

  ////// Fields for reading GLB files from import-service:

  /**
   * parentElement is primarily used to retrieve .properties?.internalRepresentationReference,
   * for loading glb files from import-service. We pass the entire element
   * in case surrounding information is useful for debugging.
   */
  parentElement?: FormaElement

  /** These are the contents of the resulting GLB after importing an object */
  meshFileContents?: Uint8Array | undefined
}

export type SideEffectAdapterCacheValue = { urn: Urn; transform: Transform }

/**
 * Cache to keep track of what urn + transform was previously seen on this path
 *
 * If cache miss, SyncAdapter.create will be called
 * If cache hit, but urn or transform is different, SyncAdapter.update will be called
 * If in change, but not in current element tree, SyncAdapter.delete will be called
 */
export type SideEffectAdapterCache = Map<InternalPath, SideEffectAdapterCacheValue>

/**
 * Extend SyncAdapter to react on side effects based on changes in the element state.
 * Used in combination with useSyncAdapter.
 * */
export interface ElementStateSideEffectInterface {
  create(
    path: InternalPath,
    urn: Urn,
    data: SideEffectData,
    onReady?: () => void /* called when this path is ready for editing in WSM */,
  ): void
  update(
    path: InternalPath,
    urn: Urn,
    data: SideEffectData,
    onReady?: () => void /* called when this path is ready for editing in WSM */,
  ): void
  delete(path: InternalPath): void
  setOnReadyCallback(path: InternalPath, onReady: () => void): void
  isPendingLoad(path: InternalPath): boolean
  cache: SideEffectAdapterCache
  isLoading(): boolean
}
