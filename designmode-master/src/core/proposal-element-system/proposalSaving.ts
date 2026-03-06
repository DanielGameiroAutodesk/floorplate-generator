import type { ProposalPutBodyV3 } from "./ProposalClient"
import { ProposalClientV3 } from "./ProposalClient"
import type { NotPersistedContainers, SavingError, SavingResult, SavingSuccess } from "src/core/elements-saving/result"
import { err, genericSaveError, ok } from "src/core/elements-saving/result"
import { parseUrn } from "src/lib/element/urn"
import type { ElementSystem } from "src/core/element-systems"
import type { ProposalElement } from "src/core/elements/Proposal"
import { FetchError } from "src/lib/request"

async function saveProposal(items: NotPersistedContainers[], authContext: string): Promise<SavingResult[]> {
  const proposalItem = items.find(({ container }) => container.element.properties?.category === "proposal")

  if (!proposalItem) {
    console.error("Couldn't find proposal to save")
    return [err({ type: "NO_PROPOSAL" } as SavingError)]
  }

  const { container, dependenciesPersisted } = proposalItem
  if (!dependenciesPersisted) {
    return []
  }

  const proposalElement = container.element as ProposalElement
  const { id, revision } = parseUrn(proposalElement.urn)

  const body: ProposalPutBodyV3 = {
    name: proposalElement.properties?.name,
    properties: proposalElement.properties,
    children: proposalElement.children ?? [],
  }

  const result = await ProposalClientV3.put(id, revision, body, authContext)
    .then((res) =>
      ok<SavingSuccess>({
        updatedElementsFromSystem: res.response,
      }),
    )
    .catch((error) => {
      if (error instanceof FetchError && error.responseCode === 412) {
        return err<SavingError>({ type: "CONFLICT" })
      }
      return genericSaveError(error)
    })

  return [result]
}

export const proposalElementSystem: ElementSystem = {
  saveHandler: (elementsToSave, authContext) => {
    return saveProposal(elementsToSave, authContext)
  },
}
