import type { Urn } from "@spacemakerai/element-types"
import { ElementContainer } from "./ElementContainer"
import type { FormaElementBox } from "src/lib/element/statebox"
import { getInMapOrThrow } from "src/lib/map"
import {
  representationsByUrnToKnownRepresentations,
  type KnownRepresentations,
  type RepresentationsByUrn,
} from "./ElementRepresentations"
import { objectEntries, objectFromEntries } from "src/lib/record"

export function elementContainerTreeFromObjectsMany(
  rootUrns: Iterable<Urn>,
  elements: Map<Urn, FormaElementBox>,
  representations: RepresentationsByUrn,
  alreadyExistingContainers?: ReadonlyMap<Urn, ElementContainer>,
  containersConstructedNow?: Record<Urn, ElementContainer>,
  copyRepresentationsFrom?: Record<Urn, ElementContainer>,
): Map<Urn, ElementContainer> {
  const newContainers = containersConstructedNow ?? {}
  const result = new Map<Urn, ElementContainer>()

  for (const rootUrn of rootUrns) {
    const container = elementContainerTreeFromObjects(
      rootUrn,
      elements,
      representations,
      alreadyExistingContainers,
      newContainers,
      copyRepresentationsFrom,
    )
    result.set(rootUrn, container)
  }

  return result
}

export function elementContainerTreeFromObjects(
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  representations: RepresentationsByUrn,
  alreadyExistingContainers?: ReadonlyMap<Urn, ElementContainer>,
  containersConstructedNow?: Record<Urn, ElementContainer>,
  copyRepresentationsFrom?: Record<Urn, ElementContainer>,
): ElementContainer {
  if (alreadyExistingContainers?.has(rootUrn)) {
    return getInMapOrThrow(alreadyExistingContainers, rootUrn)
  }
  const newContainers = containersConstructedNow ?? {}
  if (newContainers[rootUrn]) return newContainers[rootUrn]

  const elementBox = elements.get(rootUrn)
  if (!elementBox) throw new Error("Did not find rootUrn when building container tree from objects")

  const element = elementBox.element

  const childContainers = (element.children ?? []).map((child) =>
    elementContainerTreeFromObjects(
      child.urn,
      elements,
      representations,
      alreadyExistingContainers,
      newContainers,
      copyRepresentationsFrom,
    ),
  )

  const thisRepresentations: KnownRepresentations = {
    ...copyRepresentationsFrom?.[element.urn]?.representations,
    ...objectFromEntries(
      objectEntries(representationsByUrnToKnownRepresentations(representations, element.urn)).filter(
        ([, v]) => v != null,
      ),
    ),
  }

  const container = elementBox.isServerState
    ? ElementContainer.fromServerElement(element, childContainers, thisRepresentations)
    : ElementContainer.fromDraftElement(element, childContainers, thisRepresentations)

  newContainers[rootUrn] = container
  return container
}
