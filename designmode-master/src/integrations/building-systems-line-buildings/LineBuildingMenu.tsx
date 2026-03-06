import { useResetRecoilState } from "recoil"
import { DrawLineBuildingMenu, SelectedLineBuildingMenu } from "./LineBuildingMenu/LineBuildingMenus"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { quickDrawTemporaryDumpAtom, useResetLineBuildingToolParams } from "./quickDrawState"
import { LINE_BUILDING_TOOL_CFG } from "./DrawNewLineBuilding/DrawLineBuilding"
import { lineBuildingApi } from "./lineBuildingApi"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import {
  resetSelectionSetSignal,
  selectedNodesSignal,
  selectedPathsInCurrentProposalAsArraySignal,
} from "src/core/selection/selectionState"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { getTranslator } from "src/i18n"

function useIsDrawingLineBuilding() {
  return toolAPI.currentToolSignal.value.id === LINE_BUILDING_TOOL_CFG.id
}

export function showLineBuildingMenu(selection: ChildNodeContainer[]) {
  if (selection.length !== 1) return false
  const selectedElement = selection[0].element
  return lineBuildingApi.isLineBuildingFormaElement(selectedElement)
}

export function LineBuildingMenu() {
  const resetEdited = exitCurrentTool
  const resetLineBuildingParams = useResetLineBuildingToolParams()
  const resetLocalParametricState = useResetRecoilState(quickDrawTemporaryDumpAtom)
  const [error, resetError] = useErrorBoundary((error, errorInfo) => {
    console.error("LineBuildingMenu error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.errors.lineBuilding.failedMenuAction),
      status: "warning",
    })
    captureException(error, { tags: { owner: "squad-composition" }, extra: { errorInfo } })
    resetSelectionSetSignal()
    resetLineBuildingParams()
    resetLocalParametricState()
    resetEdited()
    exitCurrentTool()
    resetError()
  })
  const isDrawingLineBuilding = useIsDrawingLineBuilding()

  const selectedLineBuilding = showLineBuildingMenu(selectedNodesSignal.value)
    ? selectedNodesSignal.value[0]?.element
    : undefined
  if (error) {
    resetError()
    return null
  }

  if (!selectedLineBuilding && !isDrawingLineBuilding) {
    return null
  }

  return (
    <div
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={(e) => {
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      onMouseUp={(e) => {
        e.stopPropagation()
      }}
    >
      {isDrawingLineBuilding && <DrawLineBuildingMenu />}
      {selectedLineBuilding && (
        <SelectedLineBuildingMenu
          element={selectedLineBuilding}
          elementPath={selectedPathsInCurrentProposalAsArraySignal.value[0]}
        />
      )}
    </div>
  )
}
