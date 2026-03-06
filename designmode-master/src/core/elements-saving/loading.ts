import { ElementHierarchy } from "@spacemakerai/elements-client"
import type { Urn } from "forma-elements"
import { getElementsClient } from "src/core/elements-loading/loading"
import type { SavingResult, SavingError } from "./result"
import { err, ok } from "./result"

export async function loadPersistedElementsAndChildren(urns: Set<Urn>): Promise<SavingResult[]> {
  const { elements, errors } = await ElementHierarchy.load({
    client: getElementsClient(),
    urns,
  })

  const results: SavingResult[] = []

  for (const [urn, error] of errors) {
    results.push(
      err<SavingError>({
        type: "FAILED_TO_LOAD_ELEMENT",
        error: new Error(`Failed to load ${urn}`, { cause: error }),
        urn,
      }),
    )
  }

  if (elements.size > 0) {
    results.push(
      ok({
        updatedElementsFromSystem: elements,
      }),
    )
  }

  return results
}
