import { save } from "./save.internal"
import {
  getNotPersisted,
  isSavingSignal,
  setIsSavingSignalValue,
  setSavePromiseSignalValue,
  setSavingErrorsSignalValue,
} from "./state.internal"
import type { SavingError } from "./result"
import { genericSaveError, isErr, isOk } from "./result"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { addBreadcrumb, captureException, captureMessage } from "@sentry/browser"
import { cancelLongSaveTimeDetector } from "./long-save-time-detector"
import { elementState } from "src/core/elements/ElementState"
import { assertNever } from "src/lib/assertNever"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
// eslint-disable-next-line import/no-restricted-paths
import { proposalScenarioInfoSignal } from "src/integrations/Scenarios/scenarioSelectors"
import { URLFlag } from "src/lib/featureToggling"
import { isFlagActive } from "src/lib/featureToggling"
// eslint-disable-next-line import/no-restricted-paths
import { updateFormaCloudModel, updateFormaCloudModelFAST } from "src/integrations/Scenarios/updateScenario"
// eslint-disable-next-line import/no-restricted-paths
import { loadScenario } from "src/integrations/Scenarios/scenario"

export async function triggerSave(): Promise<void> {
  cancelLongSaveTimeDetector()
  const snapshot = elementState.currentSnapshot.peek()

  const hasRecoveredElements = snapshot.status === ElementSnapshotStatus.InRecovery
  if (hasRecoveredElements) {
    return
  }

  const unsavedChanges = getNotPersisted(snapshot)
  const isSaving = isSavingSignal.peek()
  const rootUrn = snapshot.rootUrn
  const canEdit = canEditProposalSignal.peek()

  addBreadcrumb({
    type: "info",
    level: "info",
    category: "saving",
    message: "Saving started",
    data: { noUnsaved: unsavedChanges.length, canEdit, rootUrn },
  })

  if (!canEdit) {
    // When in readonly mode, we don't try to save, however we log this to Sentry as this should never happen
    console.warn("Changes has been made while in view-only mode - saving is ignored.", {
      unsavedChanges: JSON.stringify(unsavedChanges),
    })
    captureException(new Error("Trying to save when having readonly"))
    return
  }

  if (unsavedChanges.length === 0) return
  if (isSaving) return

  try {
    setIsSavingSignalValue(true)
    const promise = save(snapshot)
    setSavePromiseSignalValue(promise)
    const result = await promise

    addBreadcrumb({
      type: "info",
      level: "info",
      category: "saving",
      message: "Saving complete",
      data: {
        isOk: isOk(result),
        errors: isErr(result) ? JSON.stringify(result.data) : undefined,
      },
    })
    try {
      // Store to scenario if proposal is linked to a scenario
      if (isOk(result)) {
        const proposalScenarioInfo = proposalScenarioInfoSignal.peek()
        if (proposalScenarioInfo) {
          const { accProjectId, fileUrn, scenarioId } = proposalScenarioInfo
          console.time("update forma cloud model (proposal scenario)")
          if (isFlagActive(URLFlag.Fast)) {
            //TODO this should update the scenario state to avoid conflicts.
            await updateFormaCloudModelFAST(accProjectId, fileUrn, scenarioId)
          } else {
            await updateFormaCloudModel(accProjectId, fileUrn, scenarioId)
          }
          console.timeEnd("update forma cloud model (proposal scenario)")
          await loadScenario()
        }
      }
    } catch (error) {
      captureException(error)
    }

    if (isOk(result)) {
      elementState.updateElementStateFromSaveResponse_INTERNAL(result.data.updatedElementsFromSystem)
    } else {
      for (const error of result.data) {
        logSavingError(error)
      }
      setSavingErrorsSignalValue(result.data)
    }
  } catch (error) {
    captureException(error)
    setSavingErrorsSignalValue([genericSaveError(error).data])
  } finally {
    setIsSavingSignalValue(false)
  }
}

function logSavingError(error: SavingError) {
  switch (error.type) {
    case "CONFLICT":
    case "NO_ACCESS":
      captureMessage(`Saving error ${error.type}`, { level: "warning" })
      break
    case "SAVING_FOR_SYSTEM_NOT_IMPLEMENTED":
    case "NO_PROPOSAL":
      captureException(new Error(error.type))
      break
    case "FAILED_TO_SAVE":
      if (!error.isReported) {
        captureException(error.error)
      } else console.warn("ignoring of already reported error", error)
      break
    case "FAILED_TO_LOAD_ELEMENT":
      captureException(new Error("Failed to load element", { cause: error.error }))
      break
    case "URN_NOT_SAVED_AFTER_MAX_DEPTH":
      captureException(new Error("Failed to save due to max depth"))
      break
    default:
      assertNever(error)
  }
}
