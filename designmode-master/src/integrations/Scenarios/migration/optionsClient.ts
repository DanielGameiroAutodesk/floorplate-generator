import type { Urn } from "forma-elements"
import type { ProposalElement } from "src/core/elements/Proposal"
import { parseUrn } from "src/lib/element/urn"

type ProposalsListResponse = {
  results: ProposalElement[]
}

export async function fetchProposals(siteId: string, options?: { limit?: number; version?: number }) {
  const limit = options?.limit ?? 50
  const version = options?.version ?? 2
  const url = `/api/proposal/elements/public-api/v1alpha/proposals?authcontext=${siteId}&version=${version}&limit=${limit}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch proposals: ${response.status} ${response.statusText}`)
  }

  const data: ProposalsListResponse = await response.json()
  return data.results
}

export async function createNewProposalWithTerrain(projectId: string, proposalElementId: string) {
  const response = await fetch(
    `/api/proposal/elements/${proposalElementId}/duplicate?authcontext=${projectId}&duplicateMode=keep-base`,
    { method: "POST" },
  )
  if (!response.ok) {
    throw new Error(`Failed to create proposal: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function createDuplicateProposal(proposalUrn: Urn) {
  const { authcontext, id } = parseUrn(proposalUrn)
  const response = await fetch(`/api/proposal/elements/${id}/duplicate?authcontext=${authcontext}&duplicateMode=all`, {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error(`Failed to duplicate proposal: ${response.status} ${response.statusText}`)
  }
  return response.json()
}
