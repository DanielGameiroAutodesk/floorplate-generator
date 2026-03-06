import type { Urn } from "@spacemakerai/element-types"
import { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementContainerTreeFromObjects } from "src/core/elements/elementContainersFromObjects"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
import { captureException, setExtra } from "@sentry/browser"
import { recoverFromValidationErrors } from "src/core/elements/validation/element-validation/recover"
import type { ElementsValidationError } from "src/core/elements/validation/element-validation/types"
import type { FormaElementBox } from "src/lib/element/statebox"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { elementState } from "src/core/elements/ElementState"

function createExistingContainersMap(
  terrainContainer: ElementContainer | undefined,
  prevSnapshot: ElementSnapshot | undefined,
): Map<Urn, ElementContainer> {
  const terrainContainerEntry: [Urn, ElementContainer][] = terrainContainer
    ? [[terrainContainer.element.urn, terrainContainer]]
    : []
  const snapshotContainersEntries = prevSnapshot ? prevSnapshot.elements.entries() : []
  return new Map([...terrainContainerEntry, ...snapshotContainersEntries])
}

export function initializeElementStateForRecovery(
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  representations: RepresentationsByUrn,
  terrainContainer: ElementContainer | undefined,
  prevSnapshot: ElementSnapshot | undefined,
  errors: ElementsValidationError[],
) {
  const existingContainers = createExistingContainersMap(terrainContainer, prevSnapshot)

  setExtra("init-proposal-errors", errors)
  const errCount = errors.reduce(
    (errMap, err) => {
      errMap[err.type] = (errMap[err.type] ?? 0) + 1
      return errMap
    },
    {} as Record<ElementsValidationError["type"], number>,
  )
  console.table(errCount)
  console.error(errors)
  captureException(new Error("Validation errors on proposal init"))

  const recovered = recoverFromValidationErrors(rootUrn, elements, errors)

  const rootContainer = elementContainerTreeFromObjects(
    recovered.rootUrn,
    recovered.elements,
    representations,
    existingContainers,
  )

  elementState.reset(new ElementSnapshot(ElementSnapshotStatus.InRecovery, rootContainer, prevSnapshot?.nodes, errors))
}

export function createElementSnapshot(
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  representations: RepresentationsByUrn,
  terrainContainer: ElementContainer | undefined,
  prevSnapshot: ElementSnapshot | undefined,
) {
  const existingContainers = createExistingContainersMap(terrainContainer, prevSnapshot)

  const rootContainer = elementContainerTreeFromObjects(rootUrn, elements, representations, existingContainers)

  return new ElementSnapshot(
    rootContainer.isServerState ? ElementSnapshotStatus.Persisted : ElementSnapshotStatus.Draft,
    rootContainer,
    prevSnapshot?.nodes,
  )
}
