import ToolbarButton from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import MoveIcon from "./icons/MoveIcon"
import MoveTooltipIcon from "./icons/MoveTooltipIcon"
import RotateIcon from "./icons/RotateIcon"
import RotateTooltipIcon from "./icons/RotateTooltipIcon"
import useMovableElementsSelected from "./useMovableElementsSelected"
import { useCallback } from "react"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import type { ToolCfg } from "src/core/toolsState"
import { toolAPI } from "src/core/toolsState"
import PreciseMove from "src/integrations/tools-common/AffineTooling/PreciseMove"
import PreciseRotate from "src/integrations/tools-common/AffineTooling/PreciseRotate"
import { useMemo } from "preact/compat"
import { AnalyticsLegacy, AnalyticsTools, Analytics } from "src/core/analytics"
import { resetHighlightedFillSignal } from "src/core/selection/selectionState"

const moveToolCfg: ToolCfg = {
  id: "move",
  tool: PreciseMove,
  toolbar: "topLevel",
  propertyPanel: "default",
}
const rotateToolCfg: ToolCfg = {
  id: "rotate",
  tool: PreciseRotate,
  toolbar: "topLevel",
  propertyPanel: "default",
}

const HOTKEY_MOVE = "M"
const HOTKEY_ROTATE = "R"

export const AffineToolbar = () => {
  const currentToolId = toolAPI.currentToolSignal.value.id
  const movableElementsSelected = useMovableElementsSelected()

  const startMove = useCallback(() => {
    if (movableElementsSelected) {
      toolAPI.setTool(moveToolCfg)
      resetHighlightedFillSignal()
    }
  }, [movableElementsSelected])

  const startRotate = useCallback(() => {
    if (movableElementsSelected) {
      toolAPI.setTool(rotateToolCfg)
      resetHighlightedFillSignal()
    }
  }, [movableElementsSelected])

  const moveHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.transform.move.name),
      keyCode: HOTKEY_MOVE,
      callback: () => {
        startMove()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.PreciseMove, "toolbar")
        Analytics.trackSelectTool("move", "precise", "hotkey")
      },
      editAccessRequired: true,
    }
  }, [startMove])

  useHotkey(moveHotkey)
  const rotateHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.transform.rotate.name),
      keyCode: HOTKEY_ROTATE,
      callback: () => {
        startRotate()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Rotate, "hotkey")
        Analytics.trackSelectTool("rotate", undefined, "hotkey", undefined)
      },
      editAccessRequired: true,
    }
  }, [startRotate])
  useHotkey(rotateHotkey)

  return (
    <>
      {movableElementsSelected && (
        <>
          <ToolbarButton
            icon={<MoveIcon />}
            onClick={() => {
              startMove()
              AnalyticsLegacy.trackSelectTool(AnalyticsTools.PreciseMove, "toolbar")
              Analytics.trackSelectTool("move", "precise", "toolbar", undefined)
            }}
            label={(t) => t(($) => $.transform.move.name)}
            active={currentToolId === moveToolCfg.id}
            shortCut={HOTKEY_MOVE}
            expandedTooltip={{
              title: (t) => t(($) => $.transform.move.name),
              bodyText: (t) => t(($) => $.transform.move.tooltip),
              icon: <MoveTooltipIcon />,
            }}
          />
          <ToolbarButton
            icon={<RotateIcon />}
            onClick={() => {
              startRotate()
              AnalyticsLegacy.trackSelectTool(AnalyticsTools.Rotate, "toolbar")
              Analytics.trackSelectTool("rotate", undefined, "toolbar")
            }}
            label={(t) => t(($) => $.transform.rotate.name)}
            active={currentToolId === rotateToolCfg.id}
            shortCut={HOTKEY_ROTATE}
            expandedTooltip={{
              title: (t) => t(($) => $.transform.rotate.name),
              bodyText: (t) => t(($) => $.transform.rotate.tooltip),
              icon: <RotateTooltipIcon />,
            }}
          />
        </>
      )}
    </>
  )
}
