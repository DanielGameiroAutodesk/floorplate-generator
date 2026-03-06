import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { useRecoilState } from "recoil"
import RectangleIcon from "src/lib/components/icons/RectangleIcon"
import CircleIcon from "src/lib/components/icons/CircleIcon"
import type { GroundPolygonMode } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import {
  GROUND_POLYGON_HOTKEYS,
  previousToolMode,
} from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import FountainPenIcon from "src/lib/components/icons/FountainPenIcon"
import { useCallback, useMemo } from "preact/compat"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { drawCallbacks2DSignal } from "src/integrations/tools-common/Drawing/basicShape/DrawPolygon"
import { PickElementIcon } from "src/lib/components/icons/PickElementIcon_24"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

export default function SurfaceToolbar({
  category,
  defaultMode,
}: {
  category: string
  defaultMode: GroundPolygonMode
}) {
  const [previousMode, setMode] = useRecoilState(previousToolMode(category))
  const { onComplete, currentCompleteState } = drawCallbacks2DSignal.value
  const mode = previousMode || defaultMode

  const setRectangle = useCallback(() => {
    setMode("rectangle")
  }, [setMode])
  const setPolygon = useCallback(() => {
    setMode("freeform")
  }, [setMode])
  const setCircle = useCallback(() => {
    setMode("circle")
  }, [setMode])
  const setPick = useCallback(() => {
    setMode("pick")
  }, [setMode])

  const freeformHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.shapes.freeform),
      keyCode: GROUND_POLYGON_HOTKEYS.FREEFORM,
      callback: setPolygon,
      editAccessRequired: true,
      category: HotkeyCategory.Tools,
    }
  }, [setPolygon])

  useHotkey(freeformHotkey)

  const rectangleHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.shapes.rectangle),
      keyCode: GROUND_POLYGON_HOTKEYS.RECTANGLE,
      callback: setRectangle,
      editAccessRequired: true,
      category: HotkeyCategory.Tools,
    }
  }, [setRectangle])

  useHotkey(rectangleHotkey)

  const circleHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.shapes.circle),
      keyCode: GROUND_POLYGON_HOTKEYS.CIRCLE,
      callback: setCircle,
      editAccessRequired: true,
      category: HotkeyCategory.Tools,
    }
  }, [setCircle])

  useHotkey(circleHotkey)

  const traceHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.drawing.traceShape),
      keyCode: GROUND_POLYGON_HOTKEYS.PICK,
      callback: setPick,
      editAccessRequired: true,
      category: HotkeyCategory.Tools,
    }
  }, [setPick])

  useHotkey(traceHotkey)

  const complete = useCallback(() => {
    if (!currentCompleteState) {
      onComplete()
    } else {
      console.log("complete with state called")
      onComplete(...currentCompleteState)
    }
  }, [currentCompleteState, onComplete])

  return (
    <>
      <ToolbarButton
        icon={<FountainPenIcon />}
        onClick={setPolygon}
        label={(t) => t(($) => $.shapes.freeform)}
        active={mode === "freeform"}
        shortCut={GROUND_POLYGON_HOTKEYS.FREEFORM}
      />
      <ToolbarButton
        icon={<RectangleIcon />}
        onClick={setRectangle}
        label={(t) => t(($) => $.shapes.rectangle)}
        active={mode === "rectangle"}
        shortCut={GROUND_POLYGON_HOTKEYS.RECTANGLE}
      />
      <ToolbarButton
        icon={<CircleIcon />}
        onClick={setCircle}
        label={(t) => t(($) => $.shapes.circle)}
        active={mode === "circle"}
        shortCut={GROUND_POLYGON_HOTKEYS.CIRCLE}
      />
      <ToolbarButton
        icon={<PickElementIcon />}
        onClick={setPick}
        label={(t) => t(($) => $.drawing.traceShape)}
        active={mode === "pick"}
        shortCut={GROUND_POLYGON_HOTKEYS.PICK}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton onClick={complete} />
    </>
  )
}
