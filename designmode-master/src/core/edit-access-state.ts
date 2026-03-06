import { projectAccessSignal } from "./project/project"
import { revisionSignal } from "./proposal"
import { submodeSignal } from "./submode-state"
import { elementState } from "./elements/ElementState"
import { ElementSnapshotStatus } from "./elements/ElementSnapshotStatus"
import { computed } from "@preact/signals"
import { proposalIsLoadingSignal } from "./initialization/proposal"
import { createLocationSignal } from "src/lib/location"

export type EditAccessLevel = "view" | "edit" | "no-access"

export const currentSnapshotDoesNotAllowEditSignal = computed<boolean>(() => {
  const snapshot = elementState.currentSnapshotOrUndefinedSignal.value
  return snapshot?.status === ElementSnapshotStatus.InRecovery
})

/**
 * Returns the current edit access "view" | "edit" | "no-access".
 */
export const editAccessLevelSignal = computed<EditAccessLevel>(() => {
  const projectAccess = projectAccessSignal.value
  const disableEdit = currentSnapshotDoesNotAllowEditSignal.value

  if (projectAccess?.canEdit && !disableEdit) return "edit"
  if (projectAccess?.canView) return "view"
  return "no-access"
})

const locationSignal = createLocationSignal()

const isExplicitReadonlyRequestSignal = computed<boolean>(() => {
  return new URLSearchParams(locationSignal.value.search).has("readonly")
})

/**
 * This handles cases where we are in readonly mode regardless of proposal initialization state.
 *
 * E.g. when viewing in "compare".
 */
export const isReadonlyRegardlessOfInitializationSignal = computed<boolean>(() => {
  return (
    editAccessLevelSignal.value !== "edit" ||
    isExplicitReadonlyRequestSignal.value ||
    submodeSignal.value === "compare" ||
    // Disable edit when viewing a specific revision by having ?revision=1234567891112 as query param.
    revisionSignal.value != null
  )
})

/**
 * Extension of editAccess that also includes the ability to edit the proposal.
 *
 * E.g disabling it when viewing a revision or are in compare submode.
 *
 * This returns false during state initialization.
 */
export const canEditProposalSignal = computed<boolean>(() => {
  return (
    elementState.isInitializedSignal.value &&
    !proposalIsLoadingSignal.value &&
    !isReadonlyRegardlessOfInitializationSignal.value
  )
})
