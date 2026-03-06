import { useMemo } from "preact/hooks"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"

const IS_ON_MAC = navigator.userAgent.includes("Mac OS X")

function useShortcuts() {
  const isFormItCoreReady = formitInitializedSignal.value

  const shortcutMap = useMemo(() => {
    if (!isFormItCoreReady) return

    const shortcutKeys = FormIt.Shortcuts.GetShortcutKeys()
    return shortcutKeys.reduce((shortcutMap: any, { first: toolName, second: shortcut }: Record<string, string>) => {
      const shortcutWithoutSpaces = shortcut.replace(/\s/g, "")
      const finalShortcut = IS_ON_MAC
        ? shortcutWithoutSpaces.replace("Ctrl+", "\u2318").replace("Shift+", "\u21E7")
        : shortcutWithoutSpaces
      shortcutMap[toolName] = finalShortcut
      return shortcutMap
    }, {})
  }, [isFormItCoreReady])

  return shortcutMap
}

export default useShortcuts
