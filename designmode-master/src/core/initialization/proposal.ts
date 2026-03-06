import { getCachedLatestRevision } from "src/core/proposal-element-system/cachedProposalLatestRevision"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { PROJECT_ID } from "src/core/project/project"
import { componentsUpdatePendingSignal, resetComponentsUpdate } from "./internal/components"
import { getPendingTerrainUpdate } from "./internal/terrain"
import { bootstrapProposal, proposalFreshLoadSignal } from "./internal/proposal"
import { computed } from "@preact/signals"
import { proposalIdSignal, revisionSignal } from "src/core/proposal"

/**
 * Trigger a loading sequence for a proposal.
 *
 * If the revision is not specified, we will attempt to use the last known
 * revision and do a background refresh to get a fresh value.
 * In many cases the last known data will be in a local cache, saving a roundtrip
 * to the server and speeding up the loading process, especially when moving
 * between proposals.
 *
 * When we have a fresh proposal, we trigger a background check for updates to
 * components (base).
 *
 * During these operations the proposal is considered to be in loading state,
 * which should block e.g. editing.
 *
 * It is possible that the active proposal is changed during the process.
 * In these cases a new execution ID is created and any code scoped to the
 * old execution ID will cancel/stop.
 */
export async function loadProposal(proposalId: string, revision?: string) {
  const executionId = Symbol()
  proposalFreshLoadSignal.value = {
    executionId,
    proposalId,
    revision,
    completed: false,
  }
  resetComponentsUpdate()

  // If we have a pending terrain update always load a fresh proposal,
  // as we don't want to be updating an old proposal.
  const pendingTerrainUpdate = getPendingTerrainUpdate()
  const cachedDetails = getCachedLatestRevision(proposalId)

  if (revision == null && cachedDetails != null && pendingTerrainUpdate == null) {
    const { proposal } = await ProposalClientV3.get(proposalId, PROJECT_ID, cachedDetails.revision)
    await bootstrapProposal(executionId, proposal, { isProposalFresh: false })
  } else {
    const { proposal } = await ProposalClientV3.get(proposalId, PROJECT_ID, revision)
    await bootstrapProposal(executionId, proposal, { isProposalFresh: true })
  }
}

export const proposalIsLoadingSignal = computed<boolean>(() => {
  if (!(proposalFreshLoadSignal.value?.completed ?? false)) {
    return true
  }

  return componentsUpdatePendingSignal.value
})

// To be used by app only.
export const isCurrentProposalRevisionLoadingOrLoadedSignal = computed<boolean>(() => {
  const proposalFreshLoad = proposalFreshLoadSignal.value
  if (!proposalFreshLoad) return false

  if (proposalFreshLoad.proposalId !== proposalIdSignal.value) return false
  if (proposalFreshLoad.revision !== revisionSignal.value) return false

  return true
})
