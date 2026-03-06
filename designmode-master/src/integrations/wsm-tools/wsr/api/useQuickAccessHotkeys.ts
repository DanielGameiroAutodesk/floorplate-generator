import { useEffect } from "preact/compat"
import { hotkeyAPI, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { getShortcutStringFromKeyPair, toolMeta } from "src/integrations/wsm-tools/wsr/toolMeta"

/**
 * To add hotkeys to Quick Access, we iterate over all available tools in toolMeta.ts
 * FormIt handles the logic for what happens when hotkeys are pressed.
 */
export function useQuickAccessHotkeys() {
  useEffect(() => {
    if (!toolMeta) return

    const hotkeys = toolMeta.flatMap<HotkeyKeyRegistration>((tool) => {
      // assume we should include in QuickAccess unless explicitly set to false
      tool.IncludeInQuickAccess === undefined ? (tool.IncludeInQuickAccess = true) : tool.IncludeInQuickAccess

      if (tool.IncludeInQuickAccess) {
        const hotkey: HotkeyKeyRegistration = {
          // TODO(l10n)
          description: () => tool.Name,
          keyCode: getShortcutStringFromKeyPair(tool.TKeyPair),
          editAccessRequired: true,
          callback: () => {
            // These tools are not compatible with StartTool
            const UITool: FormIt.ToolType[] = [
              FormIt.ToolType.SHELL_BODY,
              FormIt.ToolType.OFFSET_BODY,
              FormIt.ToolType.BLEND,
            ]

            if (tool.ToolType && !UITool.includes(tool.ToolType)) {
              FormIt.Tools.StartTool(tool.ToolType)
            } else if (tool.Command) {
              FormIt.Commands.DoCommand(tool.Command)
            }
          },
          category: tool?.Category,
        }

        return hotkey
      } else {
        return []
      }
    })

    hotkeys.forEach((hotkey) => hotkeyAPI.registerHotkey(hotkey))

    return () => {
      hotkeys.forEach((hotkey) => hotkeyAPI.removeHotkey(hotkey))
    }
  }, [])
}
