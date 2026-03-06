import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { useRecoilState } from "recoil"
import type { GroundPolygonMode } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import {
  GROUND_POLYGON_HOTKEYS,
  previousToolMode,
} from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import FountainPenIcon from "src/lib/components/icons/FountainPenIcon"
import CylinderIcon from "src/lib/components/icons/CylinderIcon"
import RectangleVolumeIcon from "src/lib/components/icons/RectangleVolumeIcon"
import { useCallback, useMemo } from "preact/compat"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { PickElementIcon } from "src/lib/components/icons/PickElementIcon_24"
import { drawCallbacks25DSignal } from "src/integrations/tools-common/Drawing/compoundShape/DrawBox25D"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

export default function VolumeToolbar({ category, defaultMode }: { category: string; defaultMode: GroundPolygonMode }) {
  const [mode, setMode] = useRecoilState(previousToolMode(category))
  const { onComplete } = drawCallbacks25DSignal.value
  const groundPolygonMode = mode || defaultMode

  const setFreeform = useCallback(() => setMode("freeform"), [setMode])
  const setRectangle = useCallback(() => setMode("rectangle"), [setMode])
  const setCircle = useCallback(() => setMode("circle"), [setMode])
  const setPick = useCallback(() => setMode("pick"), [setMode])

  const hotkeyFreeform: HotkeyKeyRegistration = useMemo(() => {
    return {
      description: (t) => t(($) => $.shapes.freeform),
      keyCode: GROUND_POLYGON_HOTKEYS.FREEFORM,
      editAccessRequired: false,
      callback: setFreeform,
      category: HotkeyCategory.Tools,
    }
  }, [setFreeform])

  useHotkey(hotkeyFreeform)

  const hotkeyRectangle: HotkeyKeyRegistration = useMemo(() => {
    return {
      description: (t) => t(($) => $.shapes.cube),
      keyCode: GROUND_POLYGON_HOTKEYS.RECTANGLE,
      editAccessRequired: false,
      callback: setRectangle,
      category: HotkeyCategory.Tools,
    }
  }, [setRectangle])

  useHotkey(hotkeyRectangle)

  const hotkeyCircle: HotkeyKeyRegistration = useMemo(() => {
    return {
      description: (t) => t(($) => $.shapes.cylinder),
      keyCode: GROUND_POLYGON_HOTKEYS.CIRCLE,
      editAccessRequired: false,
      callback: setCircle,
      category: HotkeyCategory.Tools,
    }
  }, [setCircle])

  useHotkey(hotkeyCircle)

  const hotkeyPick: HotkeyKeyRegistration = useMemo(() => {
    return {
      description: (t) => t(($) => $.drawing.traceShape),
      keyCode: GROUND_POLYGON_HOTKEYS.PICK,
      editAccessRequired: false,
      callback: setPick,
    }
  }, [setPick])

  useHotkey(hotkeyPick)

  const complete = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <>
      <ToolbarButton
        icon={<FountainPenIcon />}
        onClick={setFreeform}
        label={(t) => t(($) => $.shapes.freeform)}
        active={groundPolygonMode === "freeform"}
        shortCut={GROUND_POLYGON_HOTKEYS.FREEFORM}
      />
      <ToolbarButton
        icon={<RectangleVolumeIcon />}
        onClick={setRectangle}
        label={(t) => t(($) => $.shapes.cube)}
        active={groundPolygonMode === "rectangle"}
        shortCut={GROUND_POLYGON_HOTKEYS.RECTANGLE}
      />
      <ToolbarButton
        icon={<CylinderIcon />}
        onClick={setCircle}
        label={(t) => t(($) => $.shapes.cylinder)}
        active={groundPolygonMode === "circle"}
        shortCut={GROUND_POLYGON_HOTKEYS.CIRCLE}
      />
      <ToolbarButton
        icon={<PickElementIcon />}
        onClick={setPick}
        label={(t) => t(($) => $.drawing.traceShape)}
        active={groundPolygonMode === "pick"}
        shortCut={GROUND_POLYGON_HOTKEYS.PICK}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton onClick={complete} />
    </>
  )
}
