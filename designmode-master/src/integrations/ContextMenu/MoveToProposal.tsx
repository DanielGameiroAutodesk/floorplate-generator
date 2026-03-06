import { useComputed } from "@preact/signals"
import type { Child } from "forma-elements"
import {
  selectedBasePathsInProposalContextSignal,
  selectedTopLevelNodesSignal,
  selectionSetSignal,
  selectPaths,
  setContextRootSignal,
} from "src/core/selection/selectionState"
import { elementState } from "src/core/elements/ElementState"
import type { InternalPath } from "src/lib/element/path"
import { ROOT_KEY } from "src/lib/element/path"
import { newChildKey } from "src/lib/element/urn"
import { internalPathSetToSelectionPathSet } from "src/core/selection/selectionTypes"
import { useTranslator } from "src/i18n"

function useShowMoveToProposalSignal() {
  return useComputed(() => {
    if (selectionSetSignal.value.size === 0) return false

    const basePath = elementState.currentBasePathSignal.value
    const allSelectedAreInBase = Array.from(selectionSetSignal.value).every((selectedPath) =>
      basePath.isAnchestorOf(selectedPath),
    )

    return allSelectedAreInBase
  })
}

function moveSelectedToProposal() {
  const basePath = elementState.currentBasePathSignal.peek()
  const selectedNodes = selectedTopLevelNodesSignal.peek()
  const newPaths = new Set<InternalPath>()

  elementState.edit(({ addElement, removeElement }) => {
    for (const node of selectedNodes) {
      if (node.context === "proposal") continue

      removeElement(node.context, node.child.key)
      const newChild: Child = { ...node.child, key: newChildKey() }
      addElement("proposal", newChild, node.elementContainer)
      newPaths.add(basePath.concat(newChild.key).value)
    }
  })

  setContextRootSignal(ROOT_KEY)
  selectPaths(internalPathSetToSelectionPathSet(newPaths))
}

export const MoveToProposal = () => {
  const t = useTranslator()
  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value

  const show = useShowMoveToProposalSignal().value

  if (!show) return null

  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.contextMenu.moveToProposal)}
        onClick={moveSelectedToProposal}
        disabled={selectedBasePathsInProposalContext.size > 0}
      />
      <forma-context-menu-divider />
    </>
  )
}
