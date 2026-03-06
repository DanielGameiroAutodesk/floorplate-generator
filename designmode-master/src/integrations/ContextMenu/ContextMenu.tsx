import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"
import { useCallback } from "preact/compat"
import { MOUSE, Vector2 } from "three"
import {
  selectedBasePathsInProposalContextSignal,
  selectedPathsInCurrentProposalAsArraySignal,
} from "src/core/selection/selectionState"
import { ContextMenuLibraryPanel } from "./ContextMenuLibraryPanel"
import { ContextMenuCopyPaste } from "./ContextMenuCopyPaste"
import { ContextMenuUndoRedo } from "./ContextMenuUndoRedo"
import EditIn3DSketchMenu from "./EditIn3DSketchMenu"
import { MoveToBase } from "./MoveToBase"
import { MoveToProposal } from "./MoveToProposal"
import {
  is3DSketchBuildingFloorSelectedSignal,
  isElementEditableIn3DSketchWithCheckSignal,
} from "src/integrations/3dsketch/3dsketch-selection-state"
import { ReorderLayers } from "./ReorderLayers"
import EditSelection from "./EditSelection"
import { useDeleteSelected } from "src/integrations/tools-common/deleteSelected"
import LabelContextMenu from "src/integrations/labels/LabelContextMenu/LabelContextMenu"
import { BasicBuildingRightClickOptionsWrapper } from "src/integrations/building-systems-basic-building/BasicBuildingContextMenu"
import { EditSelectionWithExtensionContextMenuItems } from "src/integrations/extensions/Entrypoints/EditSelectionWithExtensionContextMenuItems"
import { PROJECT_ID } from "src/core/project/project"
import { contextMenuPositionSignal, setContextMenuPositionSignalValue } from "src/core/context-menu-state"
import { ReorderTerrainPads } from "./ReorderTerrainPads"
import { SelectTerrainPad } from "./SelectElement"
import { useTranslator } from "src/i18n"

export function ContextMenu() {
  const t = useTranslator()
  const selection = selectedPathsInCurrentProposalAsArraySignal.value

  const isElementEditableIn3DSketch = isElementEditableIn3DSketchWithCheckSignal.value

  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value
  const is3DSketchBuildingFloorSelected = is3DSketchBuildingFloorSelectedSignal.value

  const deleteSelected = useDeleteSelected()

  const canDelete =
    selection.length > 0 && selectedBasePathsInProposalContext.size === 0 && !is3DSketchBuildingFloorSelected

  const canCopy = selection.length > 0 && !is3DSketchBuildingFloorSelected

  return (
    <forma-context-menu>
      <EditSelection />
      <EditSelectionWithExtensionContextMenuItems projectId={PROJECT_ID} />
      {isElementEditableIn3DSketch && <EditIn3DSketchMenu />}
      <ReorderLayers />
      <ReorderTerrainPads />
      <SelectTerrainPad />
      <MoveToBase />
      <MoveToProposal />
      <LabelContextMenu />
      <ContextMenuLibraryPanel />
      <BasicBuildingRightClickOptionsWrapper />
      <ContextMenuCopyPaste canDelete={canDelete} canCopy={canCopy} />
      <ContextMenuUndoRedo />
      <forma-context-menu-item
        text={t(($) => $.contextMenu.delete)}
        onClick={deleteSelected}
        disabled={!canDelete}
        shortcut-mac={"⌫"}
        shortcut-win={"Backspace"}
      />
    </forma-context-menu>
  )
}

const startpos = new Vector2()
const endpos = new Vector2()
/**
 * We listen for mouse-up events rather than context-menu events, as this is fired on mousedown.
 * */

const isOpeningContextMenu = (e: MouseEvent): boolean =>
  e.button === MOUSE.RIGHT || (e.button === MOUSE.LEFT && e.ctrlKey)

export default function ContextMenuWrapper() {
  const mousedown = useCallback((e: MouseEvent) => {
    if (!isOpeningContextMenu(e)) return Propagate.YES
    e.preventDefault()
    startpos.set(e.clientX, e.clientY)
    return Propagate.NO
  }, [])

  const mouseup = useCallback((e: MouseEvent) => {
    if (!isOpeningContextMenu(e)) return Propagate.YES
    e.preventDefault()
    endpos.set(e.clientX, e.clientY)
    if (startpos.distanceTo(endpos) < 5) {
      setContextMenuPositionSignalValue([e.clientX, e.clientY])
    }
    return Propagate.NO
  }, [])

  const contextmenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    return Propagate.YES
  }, [])

  useEventHandler("mousedown", mousedown, Priority.RIGHT_CLICK, sceneManager.renderer.domElement)
  useEventHandler("mouseup", mouseup, Priority.RIGHT_CLICK, sceneManager.renderer.domElement)
  useEventHandler("contextmenu", contextmenu, Priority.RIGHT_CLICK, sceneManager.renderer.domElement)

  const closeRightClickMenu = useCallback(() => {
    setContextMenuPositionSignalValue(undefined)
  }, [])

  if (!contextMenuPositionSignal.value) return null
  return (
    <forma-context-menu-container
      left={contextMenuPositionSignal.value[0]}
      top={contextMenuPositionSignal.value[1]}
      onClose={closeRightClickMenu}
      onContextMenu={contextmenu}
    >
      <ContextMenu />
    </forma-context-menu-container>
  )
}
