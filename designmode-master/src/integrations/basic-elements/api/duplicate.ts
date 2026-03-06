import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { newChildKey } from "src/lib/element/urn"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import type { BasicAction, BasicCreateAction } from "./types"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"
import { getElementsWithChildren } from "src/core/elements-loading/elementFetching"
import { getRepresentationsByUrn } from "src/core/elements-loading/loading"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { getInMapOrThrow } from "src/lib/map"
import { elementState } from "src/core/elements/ElementState"
import { contextRootSignal } from "src/core/selection/selectionState"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { mergeRepresentationsByUrn } from "src/core/elements/ElementRepresentations"

export async function getDuplicateBasicElementsActions(
  childrenToDuplicate: Omit<Child, "key">[],
): Promise<BasicAction[]> {
  const currentSnapshot = elementState.currentSnapshot.peek()
  const contextRoot = contextRootSignal.peek()

  const loadedElements = new Map<Urn, FormaElement>()
  const loadedRepresentations: RepresentationsByUrn[] = []

  const missingUrns = childrenToDuplicate
    .filter((child) => !currentSnapshot.elements.has(child.urn))
    .map((child) => child.urn)

  if (missingUrns.length > 0) {
    const fetchedElements = await getElementsWithChildren(missingUrns)
    const representations = await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(fetchedElements))
    for (const item of fetchedElements.values()) {
      loadedElements.set(item.element.urn, item.element)
    }
    loadedRepresentations.push(representations)
  }

  const loadedRepresentationsMerged = mergeRepresentationsByUrn(...loadedRepresentations)

  function getData(urn: Urn) {
    const loadedElement = loadedElements.get(urn)
    if (loadedElement) {
      return {
        element: loadedElement,
        footprint: getInMapOrThrow(loadedRepresentationsMerged.footprint, urn),
      }
    }

    const node = currentSnapshot.getElementContainerOrThrow(urn)
    return {
      element: node.element,
      footprint: node.getRepresentationOrThrow("footprint"),
    }
  }

  const basicCreateActions: BasicCreateAction[] = childrenToDuplicate.map((child): BasicCreateAction => {
    const { urn, ...withoutUrn } = child
    // TODO: What about other representations if they were loaded?
    const { element, footprint } = getData(urn)
    return {
      type: "basic-create",
      parentPath: contextRoot,
      child: { ...withoutUrn, key: newChildKey() },
      feature: footprint as BasicFeature,
      properties: { ...(element.properties as BasicElementProperties) },
    }
  })
  return basicCreateActions
}
