import { computed, signal } from "@preact/signals"
import { getElementsWithChildren } from "src/core/elements-loading/elementFetching"
import { elementState } from "src/core/elements/ElementState"
import { elementContainerTreeFromObjectsMany } from "src/core/elements/elementContainersFromObjects"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { getRepresentationsByUrn } from "src/core/elements-loading/loading"
import { getInMapOrThrow } from "src/lib/map"
import { isReadonlyRegardlessOfInitializationSignal } from "src/core/edit-access-state"
import type { Urn } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { isDefined } from "src/lib/array"
import { request } from "src/lib/request"
import { traverseDepthFirst } from "src/lib/element/traverseUtils"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { PROJECT_ID } from "src/core/project/project"

const componentsUpdateSignal = signal<
  | {
      executionId: symbol
      state: "running" | "completed" | "skipped"
    }
  | undefined
>(undefined)

/** @internal */
export const componentsUpdatePendingSignal = computed(() => {
  return !componentsUpdateSignal.value || componentsUpdateSignal.value.state === "running"
})

/** @internal */
export function resetComponentsUpdate() {
  componentsUpdateSignal.value = undefined
}

function isComponentsUpdateSuperseeded(executionId: symbol) {
  return componentsUpdateSignal.peek()?.executionId !== executionId
}

function setComponentsUpdateComplete(executionId: symbol) {
  if (isComponentsUpdateSuperseeded(executionId)) return
  componentsUpdateSignal.value = { executionId, state: "completed" }
}

// (!) Be aware of async boundaries during this method invocation and what state is operated on when.
export async function refreshComponentsInBackground() {
  const executionId = Symbol()

  if (isReadonlyRegardlessOfInitializationSignal.peek()) {
    componentsUpdateSignal.value = { executionId, state: "skipped" }
    return
  }

  componentsUpdateSignal.value = { executionId, state: "running" }

  const pendingComponentUpdates = await findUpdatableComponents(
    elementState.currentSnapshot.peek().rootUrn,
    elementState.currentSnapshot.peek().getFormaElementLookup(),
  )

  if (isComponentsUpdateSuperseeded(executionId)) {
    return
  }

  if (pendingComponentUpdates.length === 0) {
    setComponentsUpdateComplete(executionId)
    return
  }

  const elements = await getElementsWithChildren(new Set(pendingComponentUpdates.map(({ newUrn }) => newUrn)))
  const representations = await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(elements))

  if (isComponentsUpdateSuperseeded(executionId)) {
    return
  }

  const containers = elementContainerTreeFromObjectsMany(
    pendingComponentUpdates.map(({ newUrn }) => newUrn),
    elements,
    representations,
    elementState.currentSnapshot.peek().elements,
  )

  for (const { oldUrn, newUrn, path } of pendingComponentUpdates) {
    const container = getInMapOrThrow(containers, newUrn)

    const proposal = elementState.currentProposalSignal.peek()
    const node = proposal.snapshot.getNode(path)
    if (!node || node.child.urn !== oldUrn) {
      // Due to async boundary the path that we wanted to update might
      // no longer be present or be changed already. If so skip this update.
      continue
    }

    if (node === proposal.base.node) {
      elementState.updateBase(container)
    } else {
      elementState.edit(({ updateElement }) => {
        updateElement("proposal", { ...node.child, urn: newUrn }, container)
      })
    }
  }

  setComponentsUpdateComplete(executionId)
}

type PendingUpdate = {
  path: InternalPath
  oldUrn: Urn
  newUrn: Urn
}

export async function findUpdatableComponents(rootUrn: Urn, elements: FormaElementLookup): Promise<PendingUpdate[]> {
  const existingComponentPaths: { path: InternalPath; oldUrn: Urn }[] = []

  traverseDepthFirst(elements, rootUrn, (child, path, element) => {
    if (element.properties?.component) {
      existingComponentPaths.push({ path, oldUrn: element.urn })
    }
  })

  const updates = await checkForComponentUpdates(existingComponentPaths.map(({ oldUrn }) => oldUrn))

  return existingComponentPaths
    .map(({ path, oldUrn }): PendingUpdate | undefined =>
      isDefined(updates[oldUrn])
        ? {
            path,
            oldUrn,
            newUrn: updates[oldUrn],
          }
        : undefined,
    )
    .filter(isDefined)
}

export function checkForComponentUpdates(componentUrns: Urn[]): Promise<Record<Urn, Urn>> {
  return request(`/api/group/elements/updates?authcontext=${PROJECT_ID}`, {
    method: "POST",
    body: JSON.stringify({
      components: componentUrns,
    }),
  }).then((res) => res.json())
}
