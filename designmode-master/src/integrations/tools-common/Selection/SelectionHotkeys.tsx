import { useCallback } from "react"
import { useEditNode } from "./editElement"
import { enterEditBase } from "src/core/useEnterEditBase"
import {
  contextRootSignal,
  resetContextRootSignal,
  resetSelectionSetSignal,
  scenarioModeSignal,
  selectedBasePathsInProposalContextSignal,
  selectedNodesSignal,
  selectedPathsInCurrentProposalSignal,
  selectionPathsSignal,
  selectionSetSignal,
  setSelectionSetSignalValue,
} from "src/core/selection/selectionState"
import type { InternalPath } from "src/lib/element/path"
import { ROOT_KEY } from "src/lib/element/path"
import { useDeleteSelected } from "src/integrations/tools-common/deleteSelected"
import { UndoRedoHotkeyBindings } from "src/integrations/tools-common/UndoRedoHotkeyBindings"
import { useCanvasCopy } from "src/integrations/tools-common/CopyPasteDuplicate/useCanvasCopy"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useCanvasPaste } from "src/integrations/tools-common/CopyPasteDuplicate/useCanvasPaste"
import { useOperationPending } from "src/integrations/PendingOperation/useOperationPending"
import { isOnMac } from "src/lib/measurementSystem"
import { useMemo } from "preact/compat"
import { elementState } from "src/core/elements/ElementState"
import { untracked } from "@preact/signals"
import { isCustomSelectionPath } from "src/core/selection/selectionTypes"

function selectAll() {
  const scenarioMode = scenarioModeSignal.peek()
  const toplevel = elementState.currentProposalSignal.peek().getToplevelNodes()
  const selection = new Set<InternalPath>()
  for (const el of toplevel) {
    if (
      el.isInBase === scenarioMode &&
      !untracked(() => el.getIsHiddenReactive()) &&
      !untracked(() => el.getIsLockedReactive()) &&
      el.elementContainer.mappedCategory !== "terrain"
    ) {
      selection.add(el.path)
    }
  }
  setSelectionSetSignalValue(selection)
}

const CopyHotkeys = () => {
  const { copy, candidates } = useCanvasCopy()
  const hotkeyRegistration = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.hotkeys.copy),
      keyCode: "c",
      ctrl: !isOnMac,
      meta: isOnMac,
      alt: false,
      shift: false,
      callback: copy,
      editAccessRequired: false,
      category: HotkeyCategory.Clipboard,
      disabled: candidates.length === 0,
    }
  }, [candidates.length, copy])
  useHotkey(hotkeyRegistration)

  return null
}

const PasteHotkeys = () => {
  const canvasPaste = useCanvasPaste()
  const hotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.paste),
      keyCode: "v",
      meta: isOnMac,
      ctrl: !isOnMac,
      alt: false,
      shift: false,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      callback: canvasPaste,
      editAccessRequired: true,
      category: HotkeyCategory.Clipboard,
    }
  }, [canvasPaste])
  useHotkey(hotkey)
  const hotKeyWithShift = useMemo<HotkeyKeyRegistration>(() => {
    return {
      ...hotkey,
      shift: true,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      callback: () => canvasPaste(true),
    }
  }, [canvasPaste, hotkey])
  useHotkey(hotKeyWithShift)

  return null
}

const CutHotkeys = () => {
  const { copy, candidates } = useCanvasCopy()
  const deleteSelected = useDeleteSelected()
  const cut = useCallback(() => {
    copy()
    deleteSelected()
  }, [copy, deleteSelected])
  const hotkeyRegistration = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.cut),
      keyCode: "x",
      ctrl: !isOnMac,
      meta: isOnMac,
      alt: false,
      shift: false,
      callback: cut,
      editAccessRequired: true,
      category: HotkeyCategory.Clipboard,
      disabled: candidates.length === 0,
    }
  }, [candidates.length, cut])
  useHotkey(hotkeyRegistration)

  return null
}

const DeleteSelectedHotkey = () => {
  const selectedPathsInProposal = selectedPathsInCurrentProposalSignal.value
  const customSelections = Array.from(selectionPathsSignal.value).filter(isCustomSelectionPath)
  const disabled = selectedPathsInProposal.size === 0 && customSelections.length === 0

  const deleteSelected = useDeleteSelected()
  const backspaceHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.deleteSelected),
      keyCode: "Backspace",
      editAccessRequired: true,
      callback: deleteSelected,
      category: HotkeyCategory.Selection,
      disabled,
    }
  }, [deleteSelected, disabled])
  useHotkey(backspaceHotkey)
  const deleteHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.deleteSelected),
      keyCode: "Delete",
      editAccessRequired: true,
      callback: deleteSelected,
      category: HotkeyCategory.Selection,
      disabled,
    }
  }, [deleteSelected, disabled])
  useHotkey(deleteHotkey)

  return null
}
const SelectAllHotkey = () => {
  const registration = useMemo<HotkeyKeyRegistration>(
    () => ({
      description: (t) => t(($) => $.hotkeys.selectAll),
      keyCode: "a",
      ctrl: !isOnMac,
      meta: isOnMac,
      alt: false,
      shift: false,
      callback: selectAll,
      editAccessRequired: false,
      category: HotkeyCategory.Selection,
    }),
    [],
  )
  useHotkey(registration)

  return null
}

const EditSelectedHotkey = () => {
  const selectedNodes = selectedNodesSignal.value
  const editNode = useEditNode("hotkey")
  const enter = useCallback(() => {
    if (!selectedNodes.length) return

    if (selectedBasePathsInProposalContextSignal.peek().size) {
      enterEditBase()
      return
    }

    if (selectedNodes.length !== 1) return

    const node = selectedNodes[0]
    editNode(node)
  }, [selectedNodes, editNode])

  const hotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.edit),
      keyCode: "Enter",
      editAccessRequired: true,
      callback: enter,
      category: HotkeyCategory.Selection,
      disabled: selectedNodes.length !== 1,
    }
  }, [enter, selectedNodes.length])

  useHotkey(hotkey)

  return null
}
const ClearSelectionHotkey = () => {
  const { isOperationPending, markOperationBlocked } = useOperationPending()
  const resetSelectionAndExitContext = useCallback(() => {
    const contextRoot = contextRootSignal.peek()
    const selections = Array.from(selectionSetSignal.peek())
    const anySelected = selections.length > 0
    if (isOperationPending) {
      markOperationBlocked()
    } else if (anySelected) {
      resetSelectionSetSignal()
    } else if (contextRoot !== ROOT_KEY) {
      resetContextRootSignal()
    }
  }, [isOperationPending, markOperationBlocked])

  const hotkeyRegistration = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitContext),
      keyCode: "Escape",
      editAccessRequired: false,
      callback: resetSelectionAndExitContext,
      category: HotkeyCategory.Selection,
    }
  }, [resetSelectionAndExitContext])

  useHotkey(hotkeyRegistration)

  return null
}
export const SelectionHotkeys = () => {
  return (
    <>
      <UndoRedoHotkeyBindings />
      <CopyHotkeys />
      <PasteHotkeys />
      <CutHotkeys />
      <DeleteSelectedHotkey />
      <SelectAllHotkey />
      <EditSelectedHotkey />
      <ClearSelectionHotkey />
    </>
  )
}
