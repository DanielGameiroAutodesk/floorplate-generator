import { captureMessage } from "@sentry/browser"
import type { Urn } from "@spacemakerai/element-types"
import { ElementHierarchy } from "@spacemakerai/elements-client"
import { getElementsClient } from "./loading"
import { FormaElementBox } from "src/lib/element/statebox"

export async function getElementsWithChildren(urns: Iterable<Urn>): Promise<Map<Urn, FormaElementBox>> {
  const start = performance.now()

  const { elements, errors } = await ElementHierarchy.load({
    client: getElementsClient(),
    urns,
  })

  if (errors.size > 0) {
    // It seems like the legacy code don't return the errors, but simply
    // returns only the elements that was without errors.
    // I think that behaviour is a bit buggy, but preserving it here
    // for now.
    console.log("Failures fetching elements:", JSON.stringify(Object.fromEntries(errors)))
    captureMessage(`Failures fetching elements`, { level: "warning" })
  }

  performance.measure("getElementsWithChildren", {
    start,
  })

  return new Map(Array.from(elements.entries(), ([urn, element]) => [urn, FormaElementBox.fromServer(element)]))
}
