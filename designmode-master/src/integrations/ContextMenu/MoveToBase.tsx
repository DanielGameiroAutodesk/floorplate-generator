import { useComputed } from "@preact/signals"
import type { Child } from "forma-elements"
import {
  selectedTopLevelNodesSignal,
  selectionArraySignal,
  selectPaths,
  setContextRootSignal,
} from "src/core/selection/selectionState"
import { elementState } from "src/core/elements/ElementState"
import type { InternalPath } from "src/lib/element/path"
import { newChildKey } from "src/lib/element/urn"
import { internalPathSetToSelectionPathSet } from "src/core/selection/selectionTypes"
import { useTranslator } from "src/i18n"

function useShowMoveToBaseSignal() {
  return useComputed<boolean>(() => {
    const selection = selectionArraySignal.value
    const basePath = elementState.currentBasePathSignal.value
    const snapshot = elementState.currentProposalSignal.value.snapshot
    if (selection.length === 0) return false
    const hasSelectedNotInBase = selection.some((selectedPath) => !basePath.isAnchestorOf(selectedPath))
    const hasBuildingDesignStuffSelected = selection.some((s) => {
      const urn = snapshot.getNode(s)?.urn
      return urn?.includes(":building-design:") || urn?.includes(":detailedbuilding:")
    })
    return hasSelectedNotInBase && !hasBuildingDesignStuffSelected
  })
}

function moveSelectedToBase() {
  const basePath = elementState.currentBasePathSignal.peek()
  const selectedNodes = selectedTopLevelNodesSignal.peek()
  const newPaths = new Set<InternalPath>()

  elementState.edit(({ addElement, removeElement }) => {
    for (const node of selectedNodes) {
      if (node.context === "base") continue

      removeElement(node.context, node.child.key)
      const newChild: Child = { ...node.child, key: newChildKey() }
      addElement("base", newChild, node.elementContainer)
      newPaths.add(basePath.concat(newChild.key).value)
    }
  })

  setContextRootSignal(basePath.value)
  selectPaths(internalPathSetToSelectionPathSet(newPaths))
}

export const MoveToBase = () => {
  const t = useTranslator()
  const showMoveToBaseSignal = useShowMoveToBaseSignal()

  if (!showMoveToBaseSignal.value) return null

  return (
    <>
      <forma-context-menu-item text={t(($) => $.contextMenu.moveToBase)} onClick={moveSelectedToBase} />
      <forma-context-menu-divider />
    </>
  )
}
