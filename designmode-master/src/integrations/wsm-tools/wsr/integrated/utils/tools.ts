import { FinishSelectionToolName } from "./enums"
import type { MainTool } from "src/integrations/wsm-tools/wsr/api/types"
import type { I18nStringProvider } from "src/i18n"

export const getMainToolBarToolsByGroupName = (groupName: string): MainTool[] => {
  const toolGroups: any[] = FormIt.Configuration.GetToolGroupUUIDs()
  const toolsGroup = toolGroups
    .map((toolGroup) => FormIt.Configuration.GetToolGroupInfo(toolGroup))
    .filter((toolGroupInfo) => toolGroupInfo.IsForMainToolsMenu && toolGroupInfo.Name === groupName)[0]
  const tools = toolsGroup?.Tools.map((tool) => FormIt.Configuration.GetToolInfo(tool))
  return tools
}

export type SelectionTool = {
  name: FinishSelectionToolName
  icon: string
  enabled: boolean
  show: boolean
  toolTip: I18nStringProvider
  handleClick: () => void
}

export const getFinishSelectionTools = (): SelectionTool[] => {
  return [
    {
      name: FinishSelectionToolName.Back,
      icon: "button_back",
      enabled: true,
      show: true,
      toolTip: (t) => t(($) => $.wsm.finishSelection.back),
      handleClick: () => {
        FormIt.Tools.FilteredSelectionToolBack()
      },
    },
    {
      name: FinishSelectionToolName.Next,
      icon: "button_next",
      enabled: true,
      show: true,
      toolTip: (t) => t(($) => $.wsm.finishSelection.next),
      handleClick: () => {
        FormIt.Tools.FilteredSelectionToolNext()
      },
    },
    {
      name: FinishSelectionToolName.Cancel,
      icon: "button_cancel",
      enabled: true,
      show: true,
      toolTip: (t) => t(($) => $.wsm.finishSelection.cancel),
      handleClick: () => {
        FormIt.Tools.FilteredSelectionToolCancel()
      },
    },
    {
      name: FinishSelectionToolName.Confirm,
      icon: "button_confirm",
      enabled: true,
      show: true,
      toolTip: (t) => t(($) => $.wsm.finishSelection.confirm),
      handleClick: () => {
        FormIt.Tools.FilteredSelectionToolConfirm()
      },
    },
  ]
}
