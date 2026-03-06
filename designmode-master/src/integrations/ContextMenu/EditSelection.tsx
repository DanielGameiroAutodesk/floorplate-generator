import ContextMenuConvertTo3DSketch from "./ContextMenuConvertTo3DSketch"
import { selectedBasePathsInProposalContextSignal, selectionArraySignal } from "src/core/selection/selectionState"
import { enterEditBase } from "src/core/useEnterEditBase"
import { isEditable, useEditNode } from "src/integrations/tools-common/Selection/editElement"
import { useCallback, useMemo } from "preact/compat"
import { isElementEditableIn3DSketchWithCheckSignal } from "src/integrations/3dsketch/3dsketch-selection-state"
import { useCanConvertTo3dSketch } from "src/integrations/3dsketch/useShouldBeEditedIn3DSketch"
import { elementState } from "src/core/elements/ElementState"
import { setContextMenuPositionSignalValue } from "src/core/context-menu-state"
import { useTranslator } from "src/i18n"

export default function EditSelection() {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value
  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value

  const isElementEditableIn3DSketch = isElementEditableIn3DSketchWithCheckSignal.value

  const showConvert3ds = useCanConvertTo3dSketch()()

  const editElement = useEditNode("context-menu")
  const selectedPaths = selectionArraySignal.value
  const selectedNode = useMemo(
    () => (selectedPaths.length > 0 ? snapshot.getNode(selectedPaths[0]) : undefined),
    [selectedPaths, snapshot],
  )
  const canEnterEditTool = useMemo(() => {
    if (!selectedNode) return false

    return isEditable(selectedNode.element)
  }, [selectedNode])

  const showEdit = useMemo(
    () => (!showConvert3ds || canEnterEditTool) && !isElementEditableIn3DSketch,
    [canEnterEditTool, isElementEditableIn3DSketch, showConvert3ds],
  )

  const clicketyClack = useCallback(() => {
    selectedNode && editElement(selectedNode)
    setContextMenuPositionSignalValue(undefined)
  }, [editElement, selectedNode])

  if (selectedBasePathsInProposalContext.size > 0 && selectedPaths.length === selectedBasePathsInProposalContext.size) {
    return (
      <>
        <forma-context-menu-item
          text={t(($) => $.base.editBaseButton)}
          onClick={(e) => enterEditBase(e, false)} // Avoids click leaking to click in canvas
          shortcut-mac={"↵"}
          shortcut-win={"↵"}
        />
        <forma-context-menu-divider />
      </>
    )
  }

  return (
    <>
      {showEdit && (
        <forma-context-menu-item
          text="Edit"
          onClick={clicketyClack}
          disabled={!canEnterEditTool}
          shortcut-mac={"↵"}
          shortcut-win={"↵"}
        />
      )}
      {showConvert3ds && <ContextMenuConvertTo3DSketch />}
      {(showConvert3ds || showEdit) && <forma-context-menu-divider />}
    </>
  )
}
