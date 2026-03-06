import type { FormaElement } from "@spacemakerai/element-types"
import { lastVisitedProposalIdKey } from "src/core/proposal"

export function getLastVisitedOrFirstProposalId(proposals: FormaElement[]): string | null {
  const proposalIds = proposals.map((p: FormaElement) => p.urn.split(":")[4])
  const lastVisitedProposalId = sessionStorage.getItem(lastVisitedProposalIdKey)

  if (lastVisitedProposalId && proposalIds.includes(lastVisitedProposalId)) {
    return lastVisitedProposalId
  }

  return proposalIds[0]
}
