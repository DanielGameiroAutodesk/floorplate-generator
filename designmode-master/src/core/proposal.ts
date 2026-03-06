import { CurrentLocation } from "src/lib/location"
import { projectAccessSignal } from "./project/project"
import { currentSnapshotDoesNotAllowEditSignal } from "./edit-access-state"
import { computed } from "@preact/signals"
import { explicitSignal } from "src/lib/signal"

export const [proposalIdSignal, setProposalIdSignalValue] = explicitSignal<string>(CurrentLocation.getProposalId())

// Specify specific revision in url, e.g ?revision=1234567891112.
export const [revisionSignal, setRevisionSignalValue] = explicitSignal<string | undefined>(
  CurrentLocation.getRevision(),
)

// Last visited proposalId is stored when switching proposals in the proposal list.
// Navigate to it if existing in the proposal list, or fallback to first in list.
export const lastVisitedProposalIdKey = "forma-last-visited-proposal-id"

export type ViewRevision = "revision-edit-access" | "revision-view-only" | "no-access" | "current" | "view-only"

export const viewRevisionSignal = computed<ViewRevision>(() => {
  const projectAccess = projectAccessSignal.value
  const disableEdit = currentSnapshotDoesNotAllowEditSignal.value
  const revision = revisionSignal.value

  if (projectAccess?.canEdit && !disableEdit && revision) return "revision-edit-access"
  if (projectAccess?.canView && revision) return "revision-view-only"
  if (projectAccess?.canEdit && !revision) return "current"
  if (projectAccess?.canView && !revision) return "view-only"

  return "no-access"
})
