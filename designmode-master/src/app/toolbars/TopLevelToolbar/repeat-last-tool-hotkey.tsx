import { useHotkey } from "src/core/hotkeys"
import { toolAPI } from "src/core/toolsState"

function activateLastTool() {
  toolAPI.setTool(toolAPI.prevToolSignal.peek())
}

export const useRepeatLastToolHotkey = () => {
  useHotkey({
    description: (t) => t(($) => $.quickAccess.repeatLastTool),
    keyCode: " ",
    callback: activateLastTool,
    editAccessRequired: true,
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
  })
}
