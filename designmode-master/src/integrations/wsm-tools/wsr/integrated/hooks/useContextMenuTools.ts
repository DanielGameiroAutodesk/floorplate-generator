import { useCallback, useMemo } from "preact/hooks"
import useShortcuts from "./useShortcuts"
import { useRecoilValue } from "recoil"
import { wsmToolActionIdsToShowState } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"

function useContextMenuTools() {
  const isFormItCoreReady = formitInitializedSignal.value
  const toolActionIdsToShow = useRecoilValue(wsmToolActionIdsToShowState)
  const shortcutMap: any = useShortcuts()

  // TODO: refactor this since the `useShortcuts` map now returns the shortcuts corresponding to the user's OS
  // It didn't make sense building two different shortcuts cause the user should only be able to use one.
  const buildShortcut = useCallback((shortcut: string) => {
    return {
      windows: shortcut,
      mac: shortcut,
    }
  }, [])

  const allTools = useMemo(() => {
    if (!isFormItCoreReady) return
    const allContextMenuTools = FormIt.Configuration.GetAllContextMenuTools()

    return allContextMenuTools.reduce((toolsMap: any, tool, index) => {
      const toolInfo = FormIt.Configuration.GetToolInfo(tool.first)
      const actionId = FormIt.Configuration.GetContextMenuActionIdFromToolUUID(tool.first)
      toolsMap[actionId] = { ...toolInfo, sort: index }

      return toolsMap
    }, {})
  }, [isFormItCoreReady])

  const toolsToShow = useMemo(() => {
    if (!toolActionIdsToShow || !allTools) return

    const eligibleTools = Object.entries(allTools).filter(([key]) => {
      return toolActionIdsToShow.includes(Number(key))
    })
    return Object.fromEntries(eligibleTools)
  }, [allTools, toolActionIdsToShow])

  const toolShortcutMap = useMemo(() => {
    if (!isFormItCoreReady) return

    // Using ESC for Exit to parent for now manually we having problems to add it to the shortcut keys
    // from FormIt Windows
    // from @joshgolstein ESC is being captured by the dialog itself
    const initialShortcutMap = {
      [FormIt.ToolType.EXIT_TO_PARENT]: {
        windows: "ESC",
        mac: "ESC",
      },
    }
    return Object.entries(allTools).reduce((_shortcutMap: any, [, tool]: [string, any]) => {
      const shortcut = shortcutMap[tool.Name]
      if (!shortcut) return _shortcutMap
      _shortcutMap[tool.ToolType] = buildShortcut(shortcut)
      return _shortcutMap
    }, initialShortcutMap)
  }, [allTools, isFormItCoreReady, shortcutMap, buildShortcut])

  const commandShortcutMap = useMemo(() => {
    if (!isFormItCoreReady) return

    const commands = FormIt.Commands.GetCommands()
    return commands.reduce((_shortcutMap: any, command) => {
      const shortcut = shortcutMap[command]
      if (!shortcut) return _shortcutMap
      _shortcutMap[command] = buildShortcut(shortcut)
      return _shortcutMap
    }, {})
  }, [isFormItCoreReady, shortcutMap, buildShortcut])

  return { allTools, toolsToShow, toolShortcutMap, commandShortcutMap }
}

export default useContextMenuTools
