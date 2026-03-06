import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useRecoilCallback } from "recoil"
import { sidebarsCollapsedState } from "src/integrations/sidebar/sidebarsState"
import { updateSidebarOnHotkey } from "./ToolWrapper"
import { isOnMac } from "src/lib/measurementSystem"
import { useMemo } from "preact/compat"

export const ToggleSideBarsHotkey = () => {
  const toggleSidebar = useRecoilCallback(
    ({ set }) =>
      () => {
        set(sidebarsCollapsedState, updateSidebarOnHotkey)
      },
    [],
  )

  const hotkeyRegistration = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.toggleSidebar),
      keyCode: ".",
      ctrl: !isOnMac,
      meta: isOnMac,
      alt: false,
      shift: false,
      editAccessRequired: false,
      callback: toggleSidebar,
    }
  }, [toggleSidebar])

  useHotkey(hotkeyRegistration)

  return null
}
