import { resetSelectionSetSignal, selectedBasePathsInProposalContextSignal } from "src/core/selection/selectionState"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { enterEditBase } from "src/core/useEnterEditBase"
import { useEditNode } from "./editElement"
import { useCallback } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { pendingOperationSignal, setPendingOperationPreventedActionSignalValue } from "src/core/pending-operation"
import { exitCurrentTool } from "src/core/toolsState"
import {
  elementSelectionPathToInternalPath,
  isCustomSelectionPath,
  isElementSelectionPath,
  type SelectionPath,
} from "src/core/selection/selectionTypes"
import { editCustomEntity } from "./editCustomEntity"

export const useDoubleClick = () => {
  const editNode = useEditNode("double-click")
  const exitTool = exitCurrentTool

  return useCallback(
    (clickedSelectionPath: SelectionPath | undefined) => {
      if (!clickedSelectionPath) {
        return
      }

      const canEdit = canEditProposalSignal.peek()
      const pendingOperation = pendingOperationSignal.peek()

      const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.peek()

      if (pendingOperation) {
        setPendingOperationPreventedActionSignalValue({
          timestamp: Date.now(),
          description: (t) => t(($) => $.tools.pendingSelectionBlockedMessage),
        })
        return
      }

      if (isCustomSelectionPath(clickedSelectionPath)) {
        editCustomEntity(clickedSelectionPath)
        return
      }

      const elementPath = isElementSelectionPath(clickedSelectionPath)
        ? elementSelectionPathToInternalPath(clickedSelectionPath)
        : undefined
      const node = elementPath && elementState.currentSnapshot.peek().getNode(elementPath)
      if (canEdit && node && selectedBasePathsInProposalContext.size > 0) {
        enterEditBase()
      } else if (canEdit && node) {
        editNode(node)
      } else {
        exitTool()

        resetSelectionSetSignal()
      }
    },
    [editNode, exitTool],
  )
}
