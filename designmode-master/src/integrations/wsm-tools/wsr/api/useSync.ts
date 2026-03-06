import { syncPath } from "src/integrations/element-state-side-effects-adapter/syncPath"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import { isImportElement } from "src/integrations/3dsketch/3dsketch-selection-state"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { isParcelComposition } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import { useCallback } from "preact/hooks"

function getPathAndChildPaths(path: InternalPath, snapshot: ElementSnapshot): InternalPath[] {
  const element = snapshot.getNodeOrThrow(path).element

  // If we have a WSM or AXM backed element, don't sync the children. We assume the
  // wsm representation includes all relevant geometry.
  if (
    element?.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm") ||
    element?.properties?.spacemakerObjectStorageReferenceFormats?.includes("wsm")
  ) {
    return [path]
  }

  // Sync whole buildings at once, not by floor, so stop traversing here if category is building.
  // However, for houses (rowhouse lines or single houses), we do want to keep traversing, as the
  // actual buildings are at depth 2-3 in the hierarchy (rowhouse line -> house template -> house
  // building, with category=building both of the house template level and on the building level)
  const isRowHouseElement = isCompositionElement(element) || isParcelComposition(element)
  if (element.properties?.category === "building" && !isRowHouseElement) {
    return [path]
  }

  //Don't sync a single floor. Instead sync the building that owns the floor.
  if (element.properties?.category === "floor") {
    const parentPath = getParentPath(path)
    if (parentPath && parentPath !== "root") {
      const parentNode = snapshot.getNode(parentPath)
      if (parentNode) {
        if (parentNode.element.properties?.category === "building") {
          return [parentPath]
        }
      }
    }
  }

  // Only use parent path if syncing an import
  if (isImportElement(element)) return [path]

  const childPaths = element.children?.flatMap(({ key }) => getPathAndChildPaths(`${path}/${key}`, snapshot)) ?? []
  return [path, ...childPaths]
}

// WSMSyncUtils - Used to continue or break out of a sync loop
// if multiple syncs are running at the same time
export const WSMSyncUtils = {
  _lastSyncPath: "",
  stopSync() {
    // This will stop any running sync loops that may be occurring
    this._lastSyncPath = ""
  },
  startSync(path: InternalPath) {
    return (this._lastSyncPath = path)
  },
  getLastSyncPath() {
    return this._lastSyncPath
  },
}

export function useSyncPath() {
  return useCallback((path: InternalPath, readyCallback?: () => void, forBrep?: boolean) => {
    const proposal = elementState.currentProposalSignal.peek()
    // Set to the parent building path if this is a floor we're syncing
    let checkPath = path
    // See if this is going to be a building
    const element = elementState.currentSnapshot.peek().getNode(path)?.elementContainer.element
    if (element?.properties?.category === "floor") {
      const parentPath = getParentPath(path)
      if (parentPath && parentPath !== "root") {
        // Use the parent/building path instead of the floor path to base sync on
        checkPath = parentPath
      }
    }
    // Return if another sync was started for this path
    if (WSMSyncUtils.getLastSyncPath() === checkPath) return
    // Otherwise, start the sync with the path
    WSMSyncUtils.startSync(checkPath)
    const allPaths = getPathAndChildPaths(path, proposal.snapshot)

    // Keep track of the time spent syncing.
    let updateBeforeTime = false
    let beforeTime = new Date().getTime()

    // Generator that gives control back to the browser after 30 ms of path sync's.
    function* syncPathThenYield() {
      let index = 0
      while (index < allPaths.length) {
        if (updateBeforeTime) {
          updateBeforeTime = false
          beforeTime = new Date().getTime()
        }

        const savedIndex = index

        syncPath(wsmSideEffectAdapter, allPaths[savedIndex], proposal, readyCallback, undefined, forBrep, element)
        const elasped = new Date().getTime() - beforeTime

        // break out of loop if other sync was started
        if (WSMSyncUtils.getLastSyncPath() !== checkPath) break

        index++

        // Note having the yield here is required so the browser is not locked.
        // At the same time, the yield is expensive! Syncing 4000 trees takes
        // about 15 seconds without the yields, 90 seconds with it at 30 ms
        // increments, and 10 minutes yielding at every loop.
        // Note we could reduce the 15 seconds it takes to do this all at once
        // by making the sync a single API call, but that means if it is too
        // slow, we would not have the options of doing the sync one tree at a
        // time. Also the strategy of using one API call does not help if
        // loading an ifc for example.
        if (index + 1 < allPaths.length && elasped > 30) {
          updateBeforeTime = true
          yield index
        }
      }

      // Clear the last path synced once we're done
      if (WSMSyncUtils.getLastSyncPath() === checkPath) {
        WSMSyncUtils.stopSync()
      }
    }

    // Sync all the paths yielding between. This is done
    // recursively.
    let it = syncPathThenYield()
    function syncAllPathsWithYieldRecursively() {
      if (!it.next().done) {
        setTimeout(() => syncAllPathsWithYieldRecursively(), 0)
      }
    }
    syncAllPathsWithYieldRecursively()
  }, [])
}
