import type { FormaElement, Transform, Urn, Volume25D, Volume25DCollection } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import type {
  ElementStateSideEffectInterface,
  FloorData,
  SideEffectAdapterCache,
} from "./ElementStateSideEffectInterface"
import { isImportElement } from "src/integrations/3dsketch/3dsketch-selection-state"
import type { Proposal } from "src/core/elements/Proposal"
import { parseUrn } from "src/lib/element/urn"
import { getRegisteredElementSystem } from "src/core/element-systems"

const representationsCache = { volume25DCollection: {} as Record<Urn, Volume25DCollection> }

function getVolume25DCollection(proposal: Proposal, urn: Urn): Volume25DCollection | undefined {
  // TODO: This does not cover the representation if stored on the element itself.

  const elements = proposal.snapshot.getFormaElementLookup()

  const cached = representationsCache.volume25DCollection[urn]
  if (cached) return cached

  const system = getRegisteredElementSystem(parseUrn(urn).system)
  const element = elements.get(urn)
  if (!element || !system?.canGenerateVolume25D?.(element) || !system?.generateVolume25D) return undefined

  function findParent(el: FormaElement): FormaElement | undefined {
    if (el.children?.some((c) => c.urn === urn)) return el
    for (const child of el.children || []) {
      const match = findParent(elements.getOrThrow(child.urn))
      if (match) return match
    }
    return undefined
  }
  const parent = findParent(elements.getOrThrow(proposal.urn))
  if (!parent) return undefined

  const result = system.generateVolume25D(element, parent)
  if (result) representationsCache.volume25DCollection[urn] = result
  return result
}

export function checkIfInCache(
  cache: SideEffectAdapterCache,
  path: InternalPath,
  urn: Urn,
  transform: Transform,
): "up-to-date" | "needs-update" | "missing" {
  const cached = cache.get(path)
  if (!cached) return "missing"

  if (cached.urn !== urn) return "needs-update"

  for (let i = 0; i < 16; i++) {
    if (cached.transform[i] !== transform[i]) {
      return "needs-update"
    }
  }
  return "up-to-date"
}

// Returns the floor geoJSON array from non AXM backed buildings. Return transforms on
// the child floors if required.
function getFloorDataArrayFromNonAXMBuilding(
  urn: Urn,
  element: FormaElement,
  getVolume25DCollection: (urn: Urn) => Volume25DCollection | undefined,
): { volume: Volume25D; transform?: Transform }[] | undefined {
  let floorDataArray: FloorData[] | undefined

  if (
    element?.properties?.category === "building" &&
    !element?.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm") &&
    !element?.properties?.spacemakerObjectStorageReferenceFormats?.includes("wsm")
  ) {
    const volume25DCollection = getVolume25DCollection(urn)
    if (volume25DCollection !== undefined) {
      floorDataArray = []
      const volume25DArray = volume25DCollection.features
      for (const volume25D of volume25DArray) {
        floorDataArray.push({ volume: volume25D })
      }
    } else if (element.children) {
      // Gather the geojson floor by floor.
      for (const child of element.children) {
        const volume25DCollection = getVolume25DCollection(child.urn)
        if (volume25DCollection !== undefined) {
          const volume25DArray = volume25DCollection.features
          if (floorDataArray === undefined) {
            floorDataArray = []
          }
          const transform = child.transform
          for (const volume25D of volume25DArray) {
            floorDataArray.push({ volume: volume25D, transform })
          }
        }
      }
    }
  }

  return floorDataArray
}

/**
 * Syncs a given path. Used when hovering over an element, for example. If isPathHidden is
 * provided, the function assumes hidden and deleted elements are possible and deletes them
 * if found.
 */
export function syncPath(
  syncAdapter: ElementStateSideEffectInterface,
  path: InternalPath,
  proposal: Proposal,
  onReady?: () => void, // called when this path is ready for editing using WSM
  isPathHidden?: (path: InternalPath) => boolean,
  forBrep?: boolean,
  parentElement?: FormaElement,
) {
  // Delete wsm geometry corresponding to hidden paths
  if (isPathHidden) {
    const isHidden = isPathHidden(path)
    if (isHidden) {
      syncAdapter.delete(path)
      syncAdapter.cache.delete(path)
      return
    }
  }

  let node = proposal.snapshot.getNode(path)
  if (!node) {
    // If isPathHidden was provided, deleted elements are possible.
    if (isPathHidden) {
      syncAdapter.delete(path)
      syncAdapter.cache.delete(path)
      return
    }
    throw new Error("did not find urn for path")
  }

  // Use the original urn to save if syncing an import
  const origNode = node
  // Use the child urn to retrieve volume if syncing an import and keep
  // track of the transform on the child
  let childTransform: Transform | undefined
  let element = node.element
  if (isImportElement(element) && element.children?.length && !element.properties?.category) {
    node = proposal.snapshot.getChildrenOfNode(node)[0]!
    childTransform = node.child.transform
    element = node.element
  }

  const transform = origNode.globalMatrix.toArray()

  const cacheStatus = checkIfInCache(syncAdapter.cache, path, node.urn, transform)
  if (cacheStatus === "up-to-date") {
    if (syncAdapter.isPendingLoad(path)) {
      //If load is still pending, update the onReady callback so the last one seen is called.
      if (onReady) {
        syncAdapter.setOnReadyCallback(path, onReady)
      }
      console.log(`Still loading data into WSM for path: ${path}`)
      return
    } else {
      onReady?.()
      return
    }
  }

  const urn = node.urn

  const volumeMesh = getVolumeMeshWithTerrainFallback(proposal, urn)
  const geoJSON = proposal.snapshot.getElementContainer(urn)?.representations.footprint
  let floorDataArray: FloorData[] | undefined

  if (volumeMesh === undefined && geoJSON === undefined) {
    // Get geojson to make floors from a non-AXM backed building.
    floorDataArray = getFloorDataArrayFromNonAXMBuilding(urn, element, (urn) => getVolume25DCollection(proposal, urn))
  }

  switch (cacheStatus) {
    case "needs-update":
      console.time("sync update")
      syncAdapter.cache.set(path, { urn, transform })
      syncAdapter.update(
        path,
        origNode.urn,
        {
          element,
          parentElement,
          volumeMesh,
          geoJSON,
          worldTransform: transform,
          floorDataArray,
          childTransform,
          forBrep,
        },
        onReady /* called when ready for editing in WSM */,
      )
      console.timeEnd("sync update")
      break
    case "missing":
      console.time("sync create")
      syncAdapter.cache.set(path, { urn, transform })
      syncAdapter.create(
        path,
        origNode.urn,
        {
          element,
          parentElement,
          volumeMesh,
          geoJSON,
          worldTransform: transform,
          floorDataArray,
          childTransform,
          forBrep,
        },
        onReady /* called when ready for editing in WSM */,
      )
      console.timeEnd("sync create")
      break
  }
}

/**
 * Updates all paths that were previously synced. Used with hover syncing when a tool initalizes.
 * Elements that have been hidden or deleted result in deleted wsm geometry.
 */
export function updateAllPreviouslySyncedPaths(
  syncAdapter: ElementStateSideEffectInterface,
  proposal: Proposal,
  isPathHidden: (path: InternalPath) => boolean,
  pathToIgnore?: InternalPath,
) {
  const allPaths = syncAdapter.cache.keys()
  FormIt.UndoManagement.BeginState()
  for (const path of allPaths) {
    if (pathToIgnore === path) {
      // If you had previously synced path, and you entered integrated 3d sketch
      // then the path is hidden, but syncPath would delete it, which we
      // don't want.
      continue
    }
    syncPath(syncAdapter, path, proposal, undefined, isPathHidden)
  }
  FormIt.UndoManagement.EndState("Sync all existing paths")
}
