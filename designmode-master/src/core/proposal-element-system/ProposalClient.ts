import type { Child, FormaElement, Transform, Urn } from "@spacemakerai/element-types"
import { FetchError, request } from "src/lib/request"
import { parseUrn } from "src/lib/element/urn"
import { validateIsElementResponse, validateIsFormaElement } from "src/lib/elementFormatUtils"
import { addBreadcrumb, captureException } from "@sentry/browser"
import type { User } from "src/lib/users"
import { getElementsClient } from "src/core/elements-loading/loading"
import { elementResponseToMap } from "@spacemakerai/elements-client"
import { getInMapOrThrow } from "src/lib/map"
import { setCachedLatestRevision } from "./cachedProposalLatestRevision"
import { clientId } from "src/core/client-id"
import { getTranslator } from "src/i18n"
import type { ProposalElement } from "src/core/elements/Proposal"

function getRootUrn(proposalId: string, response: Map<Urn, FormaElement>): Urn {
  for (const element of response.values()) {
    if (parseUrn(element.urn).id === proposalId) {
      return element.urn
    }
  }
  throw new Error("Could not find root element in proposal response")
}

// TODO: Couple this strongly to elementState instead of globally.
// Key is proposalId
const persistedElementRevision: Record<string, string | undefined> = {}

const migrateTerrainUrnV3 = (proposal: FormaElement, authContext: string): FormaElement => {
  return {
    ...proposal,
    children: proposal.children?.map((child): Child => {
      const parsed = parseUrn(child.urn)
      if (parsed.system === "terrain") {
        const newUrn: Urn = `urn:adsk-forma-elements:${parsed.system}:${parsed.authcontext ?? authContext}:${parsed.id}:${
          parsed.revision
        }`
        return {
          ...child,
          urn: newUrn,
        }
      } else {
        return child
      }
    }),
  }
}

function throwError(err: unknown, message: string): never {
  if (err instanceof FetchError) {
    if (err.responseCode === 403) {
      throw new Error("NO_ACCESS")
    } else if (err.responseCode === 404) {
      throw new Error("NOT_FOUND")
    } else if (err.responseCode === 429) {
      throw new Error("TOO_MANY_REQUESTS")
    }
  }
  throw new Error(message)
}

export type ProposalPutBodyV3 = {
  name?: string
  properties?: object
  children: (Child | { urn: Urn; children?: Child[]; transform?: Transform; properties?: { [key: string]: any } })[]
}

export type RevisionMetadata = {
  revision: string
  pinnedBy?: User
  name?: string
}

export type RevisionMetadataBody = {
  name?: string
  pinnedBy?: User
}

type ProposalCreateBody = Pick<FormaElement, "children" | "properties">

async function getProposalData({ id, authcontext, revision }: { id: string; authcontext: string; revision?: string }) {
  if (revision) {
    const { elements } = await getElementsClient().getElementAutoBatched(
      `urn:adsk-forma-elements:proposal:${authcontext}:${id}:${revision}`,
    )
    return new Map(elements)
  }

  const res = await request(`/api/proposal/elements/${id}?authcontext=${authcontext}&version=2`)
    .then((res) => res.json())
    .then(validateIsElementResponse)
    .then(elementResponseToMap)

  return res
}

export namespace ProposalClientV3 {
  export const get = async (
    id: string,
    authcontext: string,
    revision?: string,
    markAsPersisted = true,
  ): Promise<{ response: Map<Urn, FormaElement>; rootUrn: Urn; proposal: ProposalElement }> => {
    addBreadcrumb({ message: "Fetch proposal", category: "fetch", level: "info" })

    let response: Map<Urn, FormaElement>
    try {
      response = await getProposalData({ id, authcontext, revision })
    } catch (err) {
      if (err instanceof FetchError && err.responseCode === 404) {
        throw new Error("PROPOSAL_NOT_FOUND")
      } else {
        console.error(err)
        throwError(err, "Failed to download proposal")
      }
    }

    const rootUrn = getRootUrn(id, response)
    const proposal = migrateTerrainUrnV3(getInMapOrThrow(response, rootUrn), authcontext) as ProposalElement
    proposal.children = (proposal.children || []).filter((child) => {
      const ignored = [":solution-service:", ":integration:"].some((part) => child.urn.includes(part))
      if (ignored) {
        const t = getTranslator()
        window.forma_toasts.push({
          content: t(($) => $.proposal.errors.ignoringOldElements),
          status: "warning",
        })
      }
      return !ignored
    })

    //temporaryTerrainModeUrnHack(proposal)
    response.set(proposal.urn, proposal)

    if (!revision && markAsPersisted) persistedElementRevision[id] = parseUrn(rootUrn).revision
    setCachedLatestRevision(id, parseUrn(rootUrn).revision)

    return { rootUrn, response, proposal }
  }

  export const put = async (
    id: string,
    nextRevision: string,
    body: ProposalPutBodyV3,
    authContext: string,
  ): Promise<{ response: Map<Urn, FormaElement>; rootUrn: Urn }> => {
    const updateScenarios = new URLSearchParams(location.search).get("updateScenarios") || "false"

    const url = `/api/proposal/elements/${id}/revisions/${persistedElementRevision[id]}?version=2&authcontext=${authContext}&nextRevision=${nextRevision}&updateScenarios=${updateScenarios}&publish=true&clientId=${clientId}`
    const response = await request(url, { method: "PUT", body: JSON.stringify(body) })
      .then((res) => res.json())
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
    const rootUrn = getRootUrn(id, response)
    persistedElementRevision[id] = parseUrn(rootUrn).revision
    setCachedLatestRevision(id, parseUrn(rootUrn).revision)
    return { rootUrn, response }
  }

  export const create = async (body: ProposalCreateBody, authContext: string): Promise<FormaElement> => {
    const url = `/api/proposal/elements?authcontext=${authContext}`
    let res: Response

    try {
      res = await request(url, { method: "POST", body: JSON.stringify(body) })
    } catch (err) {
      console.error(err)
      throwError(err, "Failed to create proposal")
    }

    const result = validateIsFormaElement(await res!.json())
    const { id, revision } = parseUrn(result.urn)
    setCachedLatestRevision(id, revision)
    return result
  }

  export const duplicateRevision = async (proposalRevision: Urn): Promise<FormaElement> => {
    const { id, revision, authcontext } = parseUrn(proposalRevision)
    const searchParams = new URLSearchParams()
    searchParams.set("authcontext", authcontext)
    searchParams.set("revision", revision)
    searchParams.set("duplicateMode", "all")

    return request(`/api/proposal/elements/${id}/duplicate?${searchParams.toString()}`, { method: "POST" })
      .then((res) => res.json())
      .then(validateIsFormaElement)
      .catch((e) => {
        captureException(new Error("Failed to duplicate proposal"))
        throw e
      })
      .then((result) => {
        const { id, revision } = parseUrn(result.urn)
        setCachedLatestRevision(id, revision)
        return result
      })
  }

  export const branch = async (proposalUrn: Urn, baseUrn: Urn): Promise<FormaElement> => {
    const searchParams = new URLSearchParams()
    const proposal = parseUrn(proposalUrn)

    searchParams.set("authcontext", proposal.authcontext)
    searchParams.set("baseUrn", baseUrn)
    searchParams.set("revision", proposal.revision)

    return await request(`/api/proposal/elements/${proposal.id}/branch?${searchParams.toString()}`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then(validateIsFormaElement)
      .then((result) => {
        const { id, revision } = parseUrn(result.urn)
        setCachedLatestRevision(id, revision)
        return result
      })
  }

  export const listRevisionsForProposal = async (
    id: string,
    authContext: string,
    omitChildren = true,
  ): Promise<FormaElement[]> => {
    const url = `/api/proposal/elements/${id}/revisions?authcontext=${authContext}&omitChildren=${omitChildren}`
    let res: Response

    try {
      res = await request(url)
    } catch (err) {
      console.error(err)
      throwError(err, "Failed to list all revisions for proposal")
    }

    const response = (await res!.json()) as FormaElement[]
    return response
  }

  export const addRevisionMetadata = async (
    elementId: string,
    revision: string,
    authContext: string,
    body: RevisionMetadataBody,
  ): Promise<RevisionMetadata[]> => {
    const url = `/api/proposal/elements/metadata/${elementId}/${revision}?authcontext=${authContext}`
    let res: Response

    try {
      res = await request(url, { method: "PUT", body: JSON.stringify(body) })
    } catch (err) {
      console.error(err)
      throwError(err, "Failed to add metadata to revision")
    }

    const response = (await res!.json()) as RevisionMetadata[]
    return response
  }

  // get all metadata for a proposal
  export const getAllMetadataForProposal = async (
    elementId: string,
    authContext: string,
  ): Promise<RevisionMetadata[]> => {
    const url = `/api/proposal/elements/metadata/${elementId}?authcontext=${authContext}`
    let res: Response

    try {
      res = await request(url, { method: "GET" })
    } catch (err) {
      console.error(err)
      throwError(err, "Failed to get all metadata for proposal")
    }

    const response = (await res!.json()) as RevisionMetadata[]
    return response
  }

  export const getProposals = async (projectId: string) => {
    const response = await request(`/api/proposal/elements?authcontext=${projectId}&version=2`)
    const proposals = (await response.json()) as FormaElement[]
    proposals.sort(
      (proposalA, proposalB) =>
        parseInt(parseUrn(proposalB.urn).revision, 10) - parseInt(parseUrn(proposalA.urn).revision, 10),
    )
    return proposals
  }
}
