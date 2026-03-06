import type { FormaElement } from "forma-elements"
import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"

export const WEBSOCKET_LIVE = new URLSearchParams(window.location.search).has("live")

export const source = "proposal-list-v2"

export const PROPOSAL_UPDATED = "forma/proposal/updated"
export const PROPOSALS_UPDATED = "forma/proposals/updated"
export const SCENARIO_UPDATED = "forma/scenario/updated"

export type ScenarioUpdated = {
  source: string
  scenario: FormaElement
}

export type ProposalUpdated = {
  source: string
  proposalId: string
}

export type ProposalsUpdated = {
  source: string
  proposals: ProposalElement[]
}

/**
 * TODO: Make a similar function to dispatch and event when deleting, adding, renaming proposals etc
 * so that it updates the proposals list (refetches proposals)
 * if multiple users are working on the same project (different tabs)
 */
export function dispatchProposalUpdated(proposalId: string) {
  if (WEBSOCKET_LIVE && window.forma_websocket) {
    window.forma_websocket.sendEvent({ type: PROPOSAL_UPDATED, proposalId })
  }
  window.dispatchEvent(
    new CustomEvent<ProposalUpdated>(PROPOSAL_UPDATED, {
      detail: { proposalId, source },
      bubbles: true,
      composed: true,
    }),
  )
}
