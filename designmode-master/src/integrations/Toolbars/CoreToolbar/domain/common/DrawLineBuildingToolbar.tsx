import { atom, useRecoilValue, useSetRecoilState } from "recoil"
import { GROUND_POLYGON_HOTKEYS } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import { useCallback } from "react"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import FountainPenIcon from "src/lib/components/icons/FountainPenIcon"

import { PickElementIcon } from "src/lib/components/icons/PickElementIcon_24"
import { useMemo } from "preact/compat"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

type ModeType = "line" | "pick"
export const drawLineBuildingModeAtom = atom<ModeType>({ key: "drawLineBuildingModeAtom", default: "line" })

export const DrawLineBuildingToolbar = () => {
  const groundPolygonMode = useRecoilValue(drawLineBuildingModeAtom)
  const setMode = useSetRecoilState(drawLineBuildingModeAtom)
  const setLine = useCallback(() => setMode("line"), [setMode])
  const setPick = useCallback(() => setMode("pick"), [setMode])

  const lineHotkey = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.basicElements.generic.line.name),
      keyCode: GROUND_POLYGON_HOTKEYS.LINE,
      editAccessRequired: false,
      callback: setLine,
    }
  }, [setLine])

  useHotkey(lineHotkey)

  const traceHotkey = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.drawing.traceShape),
      keyCode: GROUND_POLYGON_HOTKEYS.PICK,
      editAccessRequired: false,
      callback: setPick,
    }
  }, [setPick])

  useHotkey(traceHotkey)

  return (
    <>
      <ToolbarButton
        icon={<FountainPenIcon />}
        onClick={setLine}
        label={(t) => t(($) => $.basicElements.generic.line.name)}
        active={groundPolygonMode === "line"}
        shortCut={GROUND_POLYGON_HOTKEYS.LINE}
      />
      <ToolbarButton
        icon={<PickElementIcon />}
        onClick={setPick}
        label={(t) => t(($) => $.drawing.traceShape)}
        active={groundPolygonMode === "pick"}
        shortCut={GROUND_POLYGON_HOTKEYS.PICK}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton />
    </>
  )
}
