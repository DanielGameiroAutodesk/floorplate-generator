import { computed, signal } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { getPathToUrn, type InternalPath } from "src/lib/element/path"
import { Matrix4 } from "three"
import { wsmObjectToAXMStringForSave } from "./api/mapping"
import { loadWSMRepAndSetNewGroupReferencedHistory } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import {
  createScaledPositionWorldTransform,
  is3dSketchInstanceValid,
} from "src/integrations/wsm-tools/wsm-integration/wsm-utils"
import { parseUrn } from "src/lib/element/urn"
import type { Urn } from "forma-elements"
// eslint-disable-next-line local/restrict-internal
import { isSavingSignal, savingErrorsSignal } from "src/core/elements-saving/state.internal"
import { IndexedDBState } from "./indexedDBState"
import { showRecoveryConfirmSignal } from "./dialogs/RecoveryConfirm"
import { in3DSketchSignal } from "./api/EditWSMElementTool"
import { WSM_MACHINE_TOL } from "./api/types"
import { PROJECT_ID } from "src/core/project/project"
import { proposalIdSignal } from "src/core/proposal"
import debounce from "lodash/debounce"

// Internal signal for map of path to urn
const pathToUrnSignal = computed<Map<InternalPath, Urn>>(() => {
  const elements = elementState.currentSnapshot.value.getFormaElementLookup()
  const rootUrn = elementState.currentSnapshot.value.rootUrn
  return getPathToUrn(elements, rootUrn)
})

// Signal to indicate if recovery has been confirmed
export const recoveryConfirmedSignal = signal(false)
// Signal to indicate if recovery should be discarded
export const recoveryDiscardedSignal = signal(false)
// Indicates if 3d sketch is being saved to avoid infinite loops to recoverySave on model change
export const saving3dSketchSignal = signal(false)

// Recovery keys used in IndexedDBState
const wsmRecoveryInfoKey = "WSM_RecoveryInfo"
const wsmRecoveryStringKey = "WSM_RecoveryString"
const wsmRecoveryIndexKey = "WSM_RecoveryIndex"

// Index of recovery info keys currently in IndexedDBState
const wsmRecoveryIndex = new Set<string>()
// Cache for recovery info (used for synchronous querys)
const wsmRecoveryInfoCache: Record<string, any> = {}

// Signal to allow 3d sketch recovery when starting 3d sketch only
export const canRecoverSignal = signal(false)

// Signal to indicate if the recovery is being loaded
export const isRecoveryLoadingSignal = signal(false)

// Save recovery data
export const recoverySave = debounce((instancePath: WSM.GroupInstancePathInterface, path: InternalPath) => {
  if (saving3dSketchSignal.peek() || !in3DSketchSignal.peek()) return
  // Return if instance path or 3d sketch is empty
  if (!instancePath.ids.length || isSketchEmpty(instancePath)) return

  saving3dSketchSignal.value = true
  // Get the axm string
  const axmString = wsmObjectToAXMStringForSave(instancePath)
  saving3dSketchSignal.value = false
  if (!axmString) return
  const axmInfo = { path, time: Date.now() }
  const { recoveryInfoKey, recoveryStringKey } = recoveryGetIds(path)
  // console.log("Saving Recovery AXM", axmInfo, axmString)
  // Save the recovery info to IndexedDBState and cache
  void IndexedDBState.set(recoveryInfoKey, JSON.stringify(axmInfo))
  wsmRecoveryInfoCache[recoveryInfoKey] = axmInfo
  // Save the axm string to IndexedDBState
  void IndexedDBState.set(recoveryStringKey, axmString)
  // Add to index
  wsmRecoveryIndex.add(recoveryInfoKey)
  // Sync index to IndexedDBState
  recoverySyncIndex()
}, 300)

// Clear recovery data for a path
// If waitForPersisted is true, wait for 3d sketch to finish saving before clearing the recovery data
export const recoveryClear = async (waitForPersisted: boolean = false, path: InternalPath = "") => {
  const { recoveryInfoKey, recoveryStringKey } = recoveryGetIds(path)
  // If there is no recovery data, return
  if (!(await IndexedDBState.get(recoveryInfoKey))) return
  const startTime = Date.now()
  const _internal = async () => {
    // Do not clear recovery if save failed
    if (waitForPersisted && savingErrorsSignal.peek().length) return
    // If 3d sketch is being saved, wait for it to finish
    if (waitForPersisted && isSavingSignal.peek()) return setTimeout(() => void _internal(), 500)
    // Reset the recovery confirmed signal
    recoveryConfirmedSignal.value = false
    // Get the time the recovery data was saved
    const recoveryTime = Number(JSON.parse((await IndexedDBState.get(recoveryInfoKey)) ?? "null")?.time)
    // Do not clear the recovery data if it was saved after clear was called
    if (recoveryTime > startTime) return
    // console.log("Clearing Recovery AXM for ", recoveryInfoKey)
    void IndexedDBState.delete(recoveryInfoKey)
    void IndexedDBState.delete(recoveryStringKey)
    // Remove from cache
    delete wsmRecoveryInfoCache[recoveryInfoKey]
    // Remove from index
    wsmRecoveryIndex.delete(recoveryInfoKey)
    // Sync the index to IndexedDBState
    recoverySyncIndex()
  }
  // If waitForPersisted is true, wait 500ms before clearing/checking saved status
  setTimeout(() => void _internal(), waitForPersisted ? 500 : 0)
}

// Uses locally stored axm recovery string for creating if it exists and user confirms
export const recoveryForCreate = async (groupInstancePath: WSM.GroupInstancePathInterface) => {
  // Return if recovery doesn't exist or user doesn't confirm
  if (!recoveryExists()) return
  if (!(await recoveryConfirm())) return void recoveryClear()
  const { recoveryStringKey } = recoveryGetIds()
  // Check if the recovery exists and the path is for create
  // Get the axm string
  const axmString = (await IndexedDBState.get(recoveryStringKey)) ?? ""
  if (!axmString) return
  // Indicate that the recovery has been confirmed
  recoveryConfirmedSignal.value = true
  // Get the final object history id
  const finalObjectHistoryId = WSM.GroupInstancePath.GetTopObjectHistoryID(groupInstancePath)
  // Get the referenced history id
  let refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(finalObjectHistoryId.History, finalObjectHistoryId.Object)
  // Load the recovery axm string and delete current reference history id
  isRecoveryLoadingSignal.value = true
  loadWSMRepAndSetNewGroupReferencedHistory({
    wsmRepAsString: axmString,
    targetGroupInstancePath: groupInstancePath,
    targetRefHistoryId: refHistoryId,
    worldTransformToApply: createScaledPositionWorldTransform(new Matrix4().identity().toArray()),
    path: "",
    internalRepresentationHeightOffset: 0,
    snapshot: elementState.currentSnapshot.peek(),
  })
  isRecoveryLoadingSignal.value = false
}

// Uses locally stored axm recovery string for editing if it exists and user confirms
export const recoveryForEdit = async (path: InternalPath, urn: Urn, wsmRepAsString: string) => {
  // Do not recover if not allowed
  if (!recoveryExists(path) || !(await recoveryConfirm(path))) return wsmRepAsString
  // Get the recovery key
  const { recoveryStringKey } = recoveryGetIds(path)
  // Get the axm string
  const axmString = await IndexedDBState.get(recoveryStringKey)
  // If the axm string exists
  if (axmString) {
    // Indicate that the recovery has been confirmed
    recoveryConfirmedSignal.value = true
    return axmString
  }
  return wsmRepAsString
}

// Check if recovery is available for the path
export const recoveryHasPath = (path: InternalPath): boolean => {
  const { recoveryInfoKey } = recoveryGetIds(path)
  if (!wsmRecoveryInfoCache[recoveryInfoKey]) cacheRecoveryInfo(recoveryInfoKey)
  return wsmRecoveryInfoCache[recoveryInfoKey]?.path == path
}

// Get the recovery ids for the path
// This function returns the recovery info key, recovery string key and last save time
const recoveryGetIds = (path: InternalPath = "") => {
  const proposalId = proposalIdSignal.peek()
  let lastSaveTime = 0
  if (path) {
    const urn = pathToUrnSignal.peek().get(path) as Urn
    if (urn) lastSaveTime = Number(parseUrn(urn).revision)
  }
  return {
    recoveryInfoKey: [wsmRecoveryInfoKey, PROJECT_ID, proposalId, path].join("_"),
    recoveryStringKey: [wsmRecoveryStringKey, PROJECT_ID, proposalId, path].join("_"),
    lastSaveTime,
  }
}

// Initialize the recovery index and cache
function cacheRecoveryInfo(recoveryInfoKey: string) {
  void IndexedDBState.get(recoveryInfoKey).then((value) => {
    if (value) wsmRecoveryInfoCache[recoveryInfoKey] = JSON.parse(value)
    else delete wsmRecoveryInfoCache[recoveryInfoKey]
  })
}

// Initialize the recovery index from IndexedDBState and cache the recovery info
void (async () => {
  await IndexedDBState.get(wsmRecoveryIndexKey).then((value) => {
    if (value) {
      const parsed = JSON.parse(value) as Array<string>
      wsmRecoveryIndex.clear()
      parsed.forEach((item) => {
        wsmRecoveryIndex.add(item)
        // Get the axm info from IndexedDBState
        cacheRecoveryInfo(item)
      })
    }
  })
})()

export const recoveryExists = (path: InternalPath = "") => {
  const { recoveryInfoKey, lastSaveTime } = recoveryGetIds(path)
  // Check if there is recovery info
  if (!recoveryHasPath(path)) return false
  // Get the info
  const recoveryInfo = wsmRecoveryInfoCache[recoveryInfoKey]
  // Return if not recovering
  if (!canRecoverSignal.peek() || isSavingSignal.peek()) return false
  // If the element is the same as the one that was being edited when the axm recovery string was saved
  // and the recovery was saved after the last revision of the element
  return recoveryInfo && recoveryInfo.path == path && recoveryInfo.time - lastSaveTime > 1000
}

// Confirm recovery
const confirmTimeSignal = signal(new Date())
export const recoveryResponded = () => {
  const timeDiff = new Date().getTime() - confirmTimeSignal.peek().getTime()
  // If the confirmation was responded to within 1 second, return true
  if (0 < timeDiff && timeDiff < 1000) return true
  return false
}
// Helper function to check if the recovery is being used
export const recoveryRespondedConfirmed = () => {
  return recoveryResponded() && recoveryConfirmedSignal.peek()
}
export const recoveryConfirm = (path: InternalPath = "") => {
  // Return false if we can't recover right now
  if (!canRecoverSignal.peek()) return Promise.resolve(false)
  if (recoveryResponded()) return Promise.resolve(recoveryConfirmedSignal.peek())
  return new Promise(function (resolve) {
    showRecoveryConfirmSignal.value = true
    // Resolve the promise when the modal closes
    const listener = (value: boolean) => {
      if (!value) {
        unsubscribe()
        // Update the last confirmation time
        confirmTimeSignal.peek().setTime(new Date().getTime())

        // Get the user's response
        const isConfirmed = recoveryConfirmedSignal.peek()

        // Clear the recovery data only if the user clicked on "Discard"
        if (!isConfirmed && recoveryDiscardedSignal.peek()) void recoveryClear(false, path)

        resolve(isConfirmed)
      }
    }
    const unsubscribe = showRecoveryConfirmSignal.subscribe(listener)
  })
}

// Sync the recovery index to IndexedDBState
const recoverySyncIndex = debounce(() => {
  void IndexedDBState.set(wsmRecoveryIndexKey, JSON.stringify(Array.from(wsmRecoveryIndex)))
}, 300)

// Check if the 3d sketch element in WSM is empty
export function isSketchEmpty(instancePath: WSM.GroupInstancePathInterface) {
  if (!is3dSketchInstanceValid(instancePath)) return false
  const inst = instancePath.ids[instancePath.ids.length - 1]
  const instBBox = WSM.APIGetBoxReadOnly(inst.History, inst.Object)
  return (
    instBBox.upper.z - instBBox.lower.z < WSM_MACHINE_TOL &&
    instBBox.upper.x - instBBox.lower.x < WSM_MACHINE_TOL &&
    instBBox.upper.y - instBBox.lower.y < WSM_MACHINE_TOL
  )
}
