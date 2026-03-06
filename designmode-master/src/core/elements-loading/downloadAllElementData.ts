import type { Urn } from "@spacemakerai/element-types"
import { getElementsWithChildren } from "./elementFetching"
import { getRepresentationsByUrn } from "./loading"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"

export async function downloadAllElementData(urns: Set<Urn>) {
  const elements = await getElementsWithChildren(urns)
  return { elements, representations: await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(elements)) }
}
