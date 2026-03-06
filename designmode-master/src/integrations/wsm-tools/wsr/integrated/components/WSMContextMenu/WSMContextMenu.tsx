import { Fragment } from "preact"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import useCheckSelection from "src/integrations/wsm-tools/wsr/integrated/hooks/useCheckSelection"
import useContextMenuTools from "src/integrations/wsm-tools/wsr/integrated/hooks/useContextMenuTools"
import isEmpty from "lodash/isEmpty"
import { useTranslator } from "src/i18n"
import { Analytics } from "src/core/analytics"
import { getCurveType } from "src/integrations/wsm-tools/wsr/integrated/utils"
import sceneManager from "src/core/three/sceneManager"
import { wsmToolActionIdsToShowState } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { useResetRecoilState } from "recoil"
import type { MainTool } from "src/integrations/wsm-tools/wsr/api/types"
import { getNameFromToolType } from "src/integrations/wsm-tools/wsr/toolMeta"

type Position = { x: number; y: number }

const Menu = ({ position, setPosition }: { position: Position; setPosition: (position: Position | null) => void }) => {
  const t = useTranslator()
  const clearMenu = useCallback(() => setPosition(null), [setPosition])
  const { areSmoothEdgeInSelection, hasSelectedFaces } = useCheckSelection()

  const { toolsToShow, toolShortcutMap, commandShortcutMap } = useContextMenuTools()

  const getToolsToShow = useCallback(() => {
    let tools = Object.values(toolsToShow!)

    const standardTools = [
      FormIt.ToolType.GROUP_EDIT_IN_CONTEXT_CONTEXTMENU,
      FormIt.ToolType.COPY,
      FormIt.ToolType.PASTE,
      FormIt.ToolType.DELETE_OBJECT,
    ]
    standardTools.forEach((standardTool) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const toolIndex = tools.findIndex((value, _index, _obj) => (value as MainTool).ToolType === standardTool)
      if (toolIndex !== -1) {
        tools = [...tools.filter((_, index) => index !== toolIndex), tools[toolIndex]]
      }
    })

    return tools
  }, [toolsToShow])

  if (isEmpty(toolsToShow)) return null

  const buildUndoRedoOptions = () => {
    const canUndo = FormIt.UndoManagement.CanUndo(FormIt.GroupEdit.GetEditingHistoryID())
    const canRedo = FormIt.UndoManagement.CanRedo(FormIt.GroupEdit.GetEditingHistoryID())
    const commands = {
      undo: "Edit: Undo",
      redo: "Edit: Redo",
    }

    return (
      <>
        <forma-context-menu-item
          disabled={!canUndo}
          text={t(($) => $.wsm.groupEditing.undo)}
          shortcut-mac={commandShortcutMap[commands.undo].mac}
          shortcut-windows={commandShortcutMap[commands.undo].windows}
          onClick={() => {
            FormIt.UndoManagement.Undo(FormIt.GroupEdit.GetEditingHistoryID())
            Analytics.trackSelectTool("3dSketch", "Undo", "context_menu", "design-tool")
          }}
        />
        <forma-context-menu-item
          disabled={!canRedo}
          text={t(($) => $.wsm.groupEditing.redo)}
          shortcut-mac={commandShortcutMap[commands.redo].mac}
          shortcut-windows={commandShortcutMap[commands.redo].windows}
          onClick={() => {
            FormIt.UndoManagement.Redo(FormIt.GroupEdit.GetEditingHistoryID())
            Analytics.trackSelectTool("3dSketch", "Redo", "context_menu", "design-tool")
          }}
        />
      </>
    )
  }

  const buildEditCircleSplineOptions = () => {
    const isEditingCircle = getCurveType() === window.WSM.Utils.CurveType.Circle

    const isEditingSpline = getCurveType() === window.WSM.Utils.CurveType.Spline

    if (isEditingCircle) {
      const editCircleCommand = "Tools: Edit Circle"

      return (
        <forma-context-menu-item
          text={t(($) => $.wsm.tools.editArcCircle)}
          shortcut-mac={toolShortcutMap[FormIt.ToolType.EDIT_CIRCLE]?.mac}
          shortcut-windows={toolShortcutMap[FormIt.ToolType.EDIT_CIRCLE]?.windows}
          onClick={() => {
            window.FormIt.Commands.DoCommand(editCircleCommand)
            Analytics.trackSelectTool("3dSketch", "Edit Circle", "context_menu", "design-tool")
          }}
        />
      )
    }

    if (isEditingSpline) {
      const editSplineCommand = "Tools: Edit Spline"

      return (
        <forma-context-menu-item
          text={t(($) => $.wsm.tools.editSpline)}
          shortcut-mac={toolShortcutMap[FormIt.ToolType.EDIT_SPLINE]?.mac}
          shortcut-windows={toolShortcutMap[FormIt.ToolType.EDIT_SPLINE]?.windows}
          onClick={() => {
            window.FormIt.Commands.DoCommand(editSplineCommand)
            Analytics.trackSelectTool("3dSketch", "Edit Spline", "context_menu", "design-tool")
          }}
        />
      )
    }

    return null
  }

  const buildPasteInPlaceOption = () => {
    const pasteInPlaceCommand = "Edit: Paste In Place"

    return (
      <forma-context-menu-item
        text={t(($) => $.wsm.pasteInPlaceAction)}
        shortcut-mac={commandShortcutMap[pasteInPlaceCommand].mac}
        shortcut-windows={commandShortcutMap[pasteInPlaceCommand].windows}
        onClick={() => {
          window.FormIt.Edit.PasteInPlace()
          Analytics.trackSelectTool("3dSketch", "Paste-in-Place", "context_menu", "design-tool")
          clearMenu()
        }}
      />
    )
  }

  const buildExtrudeFaceOption = () => {
    if (!hasSelectedFaces || areSmoothEdgeInSelection) return null

    return (
      <forma-context-menu-item
        text={t(($) => $.wsm.tools.extrudeFace)}
        shortcut-mac="EF"
        shortcut-windows="EF"
        onClick={() => {
          FormIt.Tools.StartTool(FormIt.ToolType.DRAG_FACE)
          clearMenu()
        }}
      />
    )
  }

  // is the current editing context below the top-level 3D Sketch container group?
  const isEditingNestedGroup = !WSM.GroupInstancePath.AreEqual(
    FormIt.GroupEdit.GetInContextEditingPathRequiredPrefix(),
    FormIt.GroupEdit.GetInContextEditingPath(),
  )

  return (
    <forma-context-menu-container top={position.y} left={position.x} onClose={() => clearMenu()}>
      <forma-context-menu min-width="220px">
        {/* loop through all FormIt tools, excluding Copy and Paste (added later) */}
        {/* only show Exit to Parent and End Group Edit if editing a nested group */}
        {/* exclude Objects to Meshes (CONCEPT-1513) */}
        {/* exclude Ungroup All to simplify the menu and match the contextual toolbar */}
        {getToolsToShow()
          .filter(
            (tool) =>
              (tool as FormIt.ToolInfo).ToolType !== FormIt.ToolType.PASTE &&
              (tool as FormIt.ToolInfo).ToolType !== FormIt.ToolType.COPY &&
              ((tool as FormIt.ToolInfo).ToolType !== FormIt.ToolType.EXIT_TO_PARENT || isEditingNestedGroup) &&
              ((tool as FormIt.ToolInfo).ToolType !== FormIt.ToolType.GROUP_EDIT_END_IN_CONTEXT ||
                isEditingNestedGroup) &&
              (tool as FormIt.ToolInfo).ToolType !== FormIt.ToolType.OBJECTS_TO_MESHES &&
              (tool as FormIt.ToolInfo).ToolType !== FormIt.ToolType.UNGROUP_ALL_CONTEXTMENU,
          )
          .sort((a, b) => (a as any).sort - (b as any).sort)
          .map((value, index) => {
            const tool = value as FormIt.ToolInfo
            return (
              <Fragment key={index}>
                <forma-context-menu-item
                  text={tool.ToolType === FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU ? "Detach" : tool.ToolTip}
                  shortcut-mac={
                    tool.ToolType === FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU
                      ? "D"
                      : toolShortcutMap[tool.ToolType!]?.mac
                  }
                  shortcut-windows={
                    tool.ToolType === FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU
                      ? "D"
                      : toolShortcutMap[tool.ToolType!]?.windows
                  }
                  onClick={() => {
                    const allCommands = FormIt.Commands.GetCommands()
                    if (!allCommands.includes(tool.Name)) {
                      console.warn(`WSMContextMenu: invalid command ${tool.Name}`)
                    }

                    const consumed = FormIt.Commands.DoCommand(tool.Name)
                    if (!consumed) {
                      console.warn(`WSMContextMenu: command not consumed ${tool.Name}`)
                    }
                    Analytics.trackSelectTool(
                      "3dSketch",
                      `${getNameFromToolType(tool.ToolType!)}`,
                      "context_menu",
                      "design-tool",
                    )
                    clearMenu()
                  }}
                />
                {tool.ToolType === FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS && buildEditCircleSplineOptions()}
                {tool.ToolType === FormIt.ToolType.TRANSLATION && buildExtrudeFaceOption()}
              </Fragment>
            )
          })}
        <forma-context-menu-divider />
        {/* add Copy and Paste */}
        {getToolsToShow()
          .filter(
            (tool) =>
              (tool as FormIt.ToolInfo).ToolType === FormIt.ToolType.PASTE ||
              (tool as FormIt.ToolInfo).ToolType === FormIt.ToolType.COPY,
          )
          .map((value) => {
            const tool = value as FormIt.ToolInfo
            return (
              <Fragment key={tool.ToolType}>
                <forma-context-menu-item
                  text={tool.ToolTip}
                  shortcut-mac={toolShortcutMap[tool.ToolType!]?.mac}
                  shortcut-windows={toolShortcutMap[tool.ToolType!]?.windows}
                  onClick={() => {
                    const consumed = FormIt.Commands.DoCommand(tool.Name)
                    if (!consumed) {
                      console.warn(`WSMContextMenu: command not consumed ${tool.Name}`)
                    }
                    Analytics.trackSelectTool(
                      "3dSketch",
                      `${getNameFromToolType(tool.ToolType!)}`,
                      "context_menu",
                      "design-tool",
                    )
                    clearMenu()
                  }}
                />
              </Fragment>
            )
          })}
        {/* add Paste-in-Place and Undo/Redo */}
        <Fragment>
          {buildPasteInPlaceOption()}
          <forma-context-menu-divider />
          {buildUndoRedoOptions()}
        </Fragment>
      </forma-context-menu>
    </forma-context-menu-container>
  )
}

const WSMContextMenu = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>()
  const resetToolActionIdsToShow = useResetRecoilState(wsmToolActionIdsToShowState)

  const onMouseUp = useCallback(
    (event: MouseEvent) => {
      if (event.button !== 2) {
        // Hiding the menu when clicking outside
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as HTMLDivElement)) {
          event.preventDefault()
          setPosition(null)
        }
        return
      }

      setPosition({
        x: event.clientX,
        y: event.clientY,
      })

      resetToolActionIdsToShow() // To avoid showing for a frame of second the stale menu options
    },
    [resetToolActionIdsToShow],
  )

  useEffect(() => {
    sceneManager.canvas.addEventListener("mouseup", onMouseUp)

    return () => {
      sceneManager.canvas.removeEventListener?.("mouseup", onMouseUp)
    }
  }, [onMouseUp])

  return <div ref={wrapperRef}>{position && <Menu position={position} setPosition={setPosition} />}</div>
}

export default WSMContextMenu
