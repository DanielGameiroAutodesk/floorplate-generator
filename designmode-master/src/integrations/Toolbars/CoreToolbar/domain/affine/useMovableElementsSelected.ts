import { selectedBasePathsInProposalContextSignal, selectionSetSignal } from "src/core/selection/selectionState"
import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import type { InternalPath } from "src/lib/element/path"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { isSiteExploreAreaElement } from "src/integrations/building-systems-site-study/iterative"

const movableElementsSelectedSignal = computed<boolean>(() => {
  const selectedPaths = Array.from(selectionSetSignal.value)
  if (selectedPaths.length === 0) return false

  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value
  if (selectedBasePathsInProposalContext.size !== 0) return false

  const snapshot = elementState.currentSnapshot.value
  if (selectedPaths.some((path) => !snapshot.getNode(path))) return false

  return selectedPaths.every(isMoveableElement(snapshot))
})

export default function useMovableElementsSelected() {
  return movableElementsSelectedSignal.value
}

const isMoveableElement = (snapshot: ElementSnapshot) => (path: InternalPath) => {
  const element = snapshot.getNodeOrThrow(path).elementContainer.element
  if (element.properties?.category === "floor") return false
  if (isSiteExploreAreaElement(element)) return false
  if (element.urn.includes(":building-design:") || element.urn.includes(":detailedbuilding:")) return false
  return true
}
