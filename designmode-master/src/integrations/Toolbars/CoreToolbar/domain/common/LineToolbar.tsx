import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { useRecoilState } from "recoil"
import type { GroundPolygonMode } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import {
  GROUND_POLYGON_HOTKEYS,
  previousToolMode,
} from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import { useCallback } from "react"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import FountainPenIcon from "src/lib/components/icons/FountainPenIcon"
import { drawCallbacks2DLineSignal } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundLine"
import { PickElementIcon } from "src/lib/components/icons/PickElementIcon_24"
import { useMemo } from "preact/hooks"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

export const LineToolbar = ({
  propertyPreset,
  defaultMode,
}: {
  propertyPreset: string
  defaultMode: GroundPolygonMode
}) => {
  const { onComplete, currentCompleteState } = drawCallbacks2DLineSignal.value
  const [mode, setMode] = useRecoilState(previousToolMode(propertyPreset))

  const activeMode = mode || defaultMode

  const setLine = useCallback(() => setMode("freeform"), [setMode])
  const setPick = useCallback(() => setMode("pick"), [setMode])

  const lineHotkey = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.basicElements.generic.line.name),
      keyCode: GROUND_POLYGON_HOTKEYS.LINE,
      editAccessRequired: false,
      callback: setLine,
      category: HotkeyCategory.Tools,
    }
  }, [setLine])

  useHotkey(lineHotkey)

  const traceHotkey = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.drawing.traceShape),
      keyCode: GROUND_POLYGON_HOTKEYS.PICK,
      editAccessRequired: false,
      callback: setPick,
      category: HotkeyCategory.Tools,
    }
  }, [setPick])

  useHotkey(traceHotkey)

  const complete = useCallback(() => {
    if (!currentCompleteState) {
      onComplete()
    } else {
      onComplete(...currentCompleteState)
    }
  }, [currentCompleteState, onComplete])

  return (
    <>
      <ToolbarButton
        icon={<FountainPenIcon />}
        onClick={setLine}
        label={(t) => t(($) => $.basicElements.generic.line.name)}
        active={activeMode === "freeform"}
        shortCut={GROUND_POLYGON_HOTKEYS.LINE}
      />
      <ToolbarButton
        icon={<PickElementIcon />}
        onClick={setPick}
        label={(t) => t(($) => $.drawing.traceShape)}
        active={activeMode === "pick"}
        shortCut={GROUND_POLYGON_HOTKEYS.PICK}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton onClick={complete} />
    </>
  )
}
