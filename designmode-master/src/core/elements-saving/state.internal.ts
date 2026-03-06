import type { Urn } from "@spacemakerai/element-types"
import type { NotPersistedContainers, Result, SavingError, SavingSuccess } from "./result"
import { computed } from "@preact/signals"
import { explicitSignal, explicitSignalWithReset } from "src/lib/signal"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"

export const [isSavingSignal, setIsSavingSignalValue] = explicitSignal<boolean>(false)

export const [savePromiseSignal, setSavePromiseSignalValue] = explicitSignal<
  Promise<Result<SavingSuccess, SavingError[]>> | undefined
>(undefined)

export const [savingErrorsSignal, setSavingErrorsSignalValue, resetSavingErrorsSignal] = explicitSignalWithReset<
  SavingError[]
>([])

export const notPersistedContainersSignal = computed<NotPersistedContainers[]>(() => {
  const snapshot = elementState.currentSnapshot.value
  return getNotPersisted(snapshot)
})

export function getNotPersisted(
  snapshot: ElementSnapshot,
  persistedUrns: Set<Urn> = new Set(),
): NotPersistedContainers[] {
  const result = new Map<Urn, NotPersistedContainers>()

  const traverseTree = (node: ChildNodeContainer) => {
    const urn = node.elementContainer.element.urn
    const childrenNodes = snapshot.getChildrenOfNode(node)
    if (!node.elementContainer.isServerState && !persistedUrns.has(urn)) {
      if (!result.has(urn)) {
        result.set(urn, {
          urn,
          container: node.elementContainer,
          dependenciesPersisted: childrenNodes.every(
            (child) => child.elementContainer.isServerState || persistedUrns.has(child.urn),
          ),
        })
      }
    }
    for (const childNode of childrenNodes) {
      traverseTree(childNode)
    }
  }
  traverseTree(snapshot.rootNode)
  return Array.from(result.values())
}
