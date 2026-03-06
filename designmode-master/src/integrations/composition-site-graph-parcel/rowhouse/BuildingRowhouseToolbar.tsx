import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { useRecoilState } from "recoil"
import type { RowhouseToolState } from "./toolState"
import { rowhouseToolState } from "./toolState"
import PlaceSingles_24 from "src/lib/components/icons/PlaceSingles_24"
import MultipleOnLine_24 from "src/lib/components/icons/MultipleOnLine_24"
import { useCallback, useMemo } from "preact/compat"
import { AnalyticsLegacy } from "src/core/analytics"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { exitCurrentTool } from "src/core/toolsState"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

export default function BuildingRowHouseToolbar() {
  const [rowhouseTool, setRowhouseTool] = useRecoilState(rowhouseToolState)
  const setTool = useCallback(
    (toolState: RowhouseToolState, method: "hotkey" | "click") => {
      // Don't track this with new tracking schema
      AnalyticsLegacy.track(CompositionEventNames.Tool_SwitchMode, {
        [CompositionTrackingDataNames.tool]: toolState,
        [CompositionTrackingDataNames.method]: method,
      })
      setRowhouseTool(toolState)
    },
    [setRowhouseTool],
  )

  const houseLineHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.drawHousesWithLine),
      keyCode: "L",
      callback: () => setTool("line", "hotkey"),
      editAccessRequired: true,
    }
  }, [setTool])

  useHotkey(houseLineHotkey)

  const placeSingleHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.placeSingleHouses),
      keyCode: "S",
      callback: () => setTool("placeSingleRowHouse", "hotkey"),
      editAccessRequired: true,
    }
  }, [setTool])

  useHotkey(placeSingleHotkey)

  return (
    <>
      <ToolbarButton
        active={rowhouseTool === "line"}
        icon={<MultipleOnLine_24 />}
        shortCut={"L"}
        label={(t) => t(($) => $.composition.rowhouse.multipleOnLineButton)}
        onClick={() => setTool("line", "click")}
      />
      <ToolbarButton
        active={rowhouseTool === "placeSingleRowHouse"}
        icon={<PlaceSingles_24 />}
        shortCut={"S"}
        label={(t) => t(($) => $.composition.rowhouse.placeSinglesButton)}
        onClick={() => {
          setTool("placeSingleRowHouse", "click")
        }}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton onClick={exitCurrentTool} />
    </>
  )
}
