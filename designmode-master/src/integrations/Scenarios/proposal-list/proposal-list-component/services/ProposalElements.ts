import type { FormaElement, Urn } from "forma-elements"
import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"

import { dispatchProposalUpdated } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import { parseUrn } from "src/lib/element/urn"
import { request } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/http"

export const createNewProposalWithTerrain = async (projectId: string, proposalElementId: string) => {
  const res = await request(
    `/api/proposal/elements/${proposalElementId}/duplicate?authcontext=${projectId}&duplicateMode=keep-base`,
    { method: "POST" },
  )
  return res?.json()
}

export const createDuplicateProposal = async (proposalUrn: Urn) => {
  const { authcontext, id } = parseUrn(proposalUrn)
  const res = await request(`/api/proposal/elements/${id}/duplicate?authcontext=${authcontext}&duplicateMode=all`, {
    method: "POST",
  })
  return res?.json()
}

type AutodeskPagination = { limit: number; nextUrl?: string | undefined }

async function getProposalsPaginated(projectId: string) {
  const baseUrl = `/api/proposal/elements/public-api/v1alpha/proposals`
  const limit = 10
  let pagination: AutodeskPagination = {
    limit,
    nextUrl: `${baseUrl}?authcontext=${projectId}&version=2&limit=${limit}`,
  }
  let proposals: ProposalElement[] = []
  // nextUrl is not returned by API when all results are fetched.
  while (pagination.nextUrl) {
    // HACK: Since this is the public API, the URL path is different.
    // overwriting the path with the internal cloudflare route:
    const url = `${baseUrl}?${pagination.nextUrl.split("?")?.[1] || ""}`
    const res = await request(url)
    if (res?.ok) {
      const body = await res?.json()
      proposals = proposals.concat(body.results)
      pagination = body.pagination satisfies AutodeskPagination
    } else {
      throw new Error("Failed to fetch proposals using pagination")
    }
  }
  return proposals
}

export const getProposals = async (projectId: string) => {
  const proposals = await getProposalsPaginated(projectId)
  proposals.sort(
    (proposalA, proposalB) =>
      parseInt(parseUrn(proposalB.urn).revision, 10) - parseInt(parseUrn(proposalA.urn).revision, 10),
  )
  return proposals
}

export const getProposalById = async (elementId: string, authContext: string): Promise<ProposalElement> => {
  const res = await request(`/api/proposal/elements/${elementId}?authcontext=${authContext}&version=2`)
  const result = (await res?.json()) as Record<Urn, FormaElement>

  const element = Object.values(result || {}).find(({ urn }) => parseUrn(urn).id === elementId)
  return element as ProposalElement
}

export const getNewestRevision = async (proposalUrn: Urn): Promise<Urn> => {
  const { id, authcontext } = parseUrn(proposalUrn)
  const result = await getProposalById(id, authcontext)
  return result.urn
}

export const deleteProposal = async (proposalUrn: Urn) => {
  const { id, authcontext } = parseUrn(proposalUrn)

  return request(`/api/proposal/elements/${id}?authcontext=${authcontext}`, {
    method: "DELETE",
  })
}

export const renameProposal = async (
  proposal: ProposalElement,
  newName: string,
  clientId?: string,
): Promise<{
  [urn: string]: ProposalElement
}> => {
  const { id, authcontext, revision } = parseUrn(proposal.urn)
  const rename = await request(
    `/api/proposal/elements/${id}/revisions/${revision}?authcontext=${authcontext}&version=2${
      clientId ? `&clientId=${clientId}` : ""
    }`,
    {
      method: "PUT",
      body: JSON.stringify({
        properties: { ...proposal.properties, name: newName },
        ...(proposal.children ? { children: proposal.children } : {}),
      }),
    },
  )

  const response = (await rename?.json()) as {
    [urn: string]: ProposalElement
  }

  const updatedProposal = Object.values(response || {}).find(
    ({ urn }) => parseUrn(urn).id === parseUrn(proposal.urn).id,
  )

  if (updatedProposal) {
    dispatchProposalUpdated(parseUrn(updatedProposal.urn).id)
  }

  return response
}
