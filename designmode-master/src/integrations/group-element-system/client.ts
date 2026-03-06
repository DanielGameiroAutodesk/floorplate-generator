import type { FormaElement, Child, Urn } from "@spacemakerai/element-types"
import { request } from "src/lib/request"
import type { NotPersistedContainers, SavingResult, SavingSuccess } from "src/core/elements-saving/result"
import { catchSavingError } from "src/core/elements-saving/result"
import { isDefined } from "src/lib/array"
import { parseUrn, urnWithoutRevision } from "src/lib/element/urn"
import { validateIsElementResponse, validateIsFormaElement } from "src/lib/elementFormatUtils"
import type { ElementSystem } from "src/core/element-systems"
import { nextIndicator } from "src/core/useBaseUtils"
import { elementResponseToMap } from "@spacemakerai/elements-client"
import { mapOfFormaElements } from "src/lib/element/utils"
import { dispatchScenarioUpdated } from "src/core/proposal-window-events/dispatchers"

type PostBody = {
  name: string
  properties?: { component?: boolean; tags?: string[]; indicator?: string }
  children?: Child[]
}

type PutBody = {
  name?: string
  properties?: { component?: boolean; tags?: string[]; indicator?: string }
  children?: Child[]
}

// Key: Urn without revision
// Value: revision
export const persistedGroupUrnMap = new Map<string, string>()

async function saveGroup(
  element: FormaElement,
  parentUrn: Urn | undefined,
  authcontext: string,
): Promise<SavingResult> {
  const body = {
    name: element.properties?.name || "Unnamed Group",
    properties: {
      name: element.properties?.name || "Unnamed Group",
      component: element.properties?.component,
      tags: element.properties?.tags,
      indicator: element.properties?.indicator,
    },
    children: element.children || [], //Need to send an empty list to remove all elements from group - undefined is not serialized.
  }

  return await catchSavingError<SavingSuccess>(() => {
    const previousRevision = persistedGroupUrnMap.get(urnWithoutRevision(element.urn))
    if (!previousRevision) {
      return GroupClient.post(element.urn, body, authcontext)
    } else {
      // We know that the group is not the root element, and therefore we know parentUrn is set
      return GroupClient.put(element.urn, body, parentUrn!, previousRevision, authcontext)
    }
  })
}

export namespace GroupClient {
  export const post = async (urn: Urn, body: PostBody, authContext: string): Promise<SavingSuccess> => {
    const { revision, id } = parseUrn(urn)
    const url = `/api/group/elements?authcontext=${authContext}&nextRevision=${revision}&elementId=${id}&version=2`
    return request(url, { method: "POST", body: JSON.stringify(body) })
      .then((r) => r.json())
      .then(validateIsFormaElement)
      .then<SavingSuccess>((element) => {
        persistedGroupUrnMap.set(urnWithoutRevision(urn), parseUrn(urn).revision)
        dispatchScenarioUpdated(element)
        return {
          updatedElementsFromSystem: mapOfFormaElements(element),
        }
      })
  }

  export const put = async (
    urn: Urn,
    body: PutBody,
    parentUrn: string,
    previousRevision: string,
    authContext: string,
  ): Promise<SavingSuccess> => {
    const { id, revision } = parseUrn(urn)

    const url = `/api/group/elements/${id}/revisions/${previousRevision}?&version=2&authcontext=${authContext}&parentUrn=${parentUrn}&nextRevision=${revision}`
    return request(url, { method: "PUT", body: JSON.stringify(body) })
      .then((r) => r.json())
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
      .then<SavingSuccess>((elements) => {
        for (const savedUrn of elements.keys()) {
          persistedGroupUrnMap.set(urnWithoutRevision(savedUrn), parseUrn(savedUrn).revision)
        }
        return {
          updatedElementsFromSystem: elements,
        }
      })
  }

  export async function saveGroups(urns: NotPersistedContainers[], authContext: string): Promise<SavingResult[]> {
    const elementsToSave = urns
      .map(({ container, dependenciesPersisted, parentUrn }) =>
        dependenciesPersisted
          ? {
              element: container.element,
              parentUrn,
            }
          : undefined,
      )
      .filter(isDefined)

    return Promise.all(
      elementsToSave.map((toSave) => {
        const { element, parentUrn } = toSave
        return saveGroup(element, parentUrn, authContext)
      }),
    )
  }

  export const getBases = async (authContext: string): Promise<FormaElement[]> => {
    const searchParams = new URLSearchParams()
    searchParams.set("tag", "scenario")
    searchParams.set("authcontext", authContext)

    return await request(`/api/group/elements/components?${searchParams.toString()}`).then((res) => res.json())
  }

  export const branchBase = async (baseToBranch: FormaElement): Promise<FormaElement> => {
    const { revision, authcontext } = parseUrn(baseToBranch.urn)
    const allBases = await GroupClient.getBases(authcontext)

    if (!allBases) throw new Error("Failed to fetch bases")

    const searchParams = new URLSearchParams()
    searchParams.set("authcontext", authcontext)

    const branchedName = `${baseToBranch.properties?.name} ${new Date(Number(revision)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })}`

    return await request(`/api/group/elements?${searchParams.toString()}`, {
      method: "POST",
      body: JSON.stringify({
        ...baseToBranch,
        name: branchedName,
        properties: {
          ...baseToBranch.properties,
          indicator: nextIndicator(allBases),
        },
      }),
    }).then((res) => res.json())
  }
}

export const groupElementSystem: ElementSystem = {
  elementsClientLoadTransform: (element: FormaElement) => {
    persistedGroupUrnMap.set(urnWithoutRevision(element.urn), parseUrn(element.urn).revision)
    return element
  },
  saveHandler: (elementsToSave, authContext) => {
    return GroupClient.saveGroups(elementsToSave, authContext)
  },
}
