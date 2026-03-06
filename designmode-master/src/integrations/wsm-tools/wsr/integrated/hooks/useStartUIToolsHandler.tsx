import { dimensionInputDialogState, wsmActiveToolState } from "src/integrations/wsm-tools/wsr/integrated/state"

import { useRecoilState } from "recoil"
import { MessageListenerResource, ResourceManager } from "@spacemakerai/web-sketch-renderer"
import { useEffect } from "preact/hooks"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import type { DimensionInputDialogType } from "src/integrations/wsm-tools/wsr/integrated/types"

/**
 * Shell, Fillet, and Offset Body all send a "kStartUITool" message that
 * needs to be handled somewhat separately from regular tools starting
 * (because they launch a dimension input dialog)
 *
 * Placed in its own hook because EditWSMElementTool is getting a bit long
 *
 * @returns null
 */
export function useStartUIToolsHandler() {
  const [dimensionInputDialog, setDimensionInputDialog] = useRecoilState(dimensionInputDialogState)
  const [, setWSMActiveTool] = useRecoilState(wsmActiveToolState)

  useEffect(() => {
    const resourceManager = new ResourceManager(getMessageHandler())
    const messageListener = new MessageListenerResource(resourceManager, "AdvancedModelingToolsListener")
    messageListener.addMessageHandler(FormIt.Message.kStartUITool, (tool: string) => {
      switch (tool) {
        case "Tools: Fillet": {
          const filletDialogState: DimensionInputDialogType = {
            isOpen: true,
            title: "Fillet",
            type: "fillet",
            inputLabel: "Fillet Radius",
            defaultValue: 1,
            fillet: { defaultValue: dimensionInputDialog.fillet?.defaultValue ?? 1 },
            offset: { defaultValue: dimensionInputDialog.offset?.defaultValue ?? -1 },
            shell: { defaultValue: dimensionInputDialog.shell?.defaultValue ?? -1 },
          }
          setDimensionInputDialog(filletDialogState)
          setWSMActiveTool(FormIt.ToolType.BLEND)
          break
        }
        case "Tools: Offset Solid": {
          const offsetDialogState: DimensionInputDialogType = {
            isOpen: true,
            title: "Offset",
            type: "offset",
            inputLabel: "Offset Distance",
            defaultValue: -1,
            offset: { defaultValue: dimensionInputDialog.offset?.defaultValue ?? -1 },
            fillet: { defaultValue: dimensionInputDialog.fillet?.defaultValue ?? 1 },
            shell: { defaultValue: dimensionInputDialog.shell?.defaultValue ?? -1 },
          }
          setDimensionInputDialog(offsetDialogState)
          setWSMActiveTool(FormIt.ToolType.OFFSET_BODY)
          break
        }
        case "Tools: Shell": {
          const shellDialogState: DimensionInputDialogType = {
            isOpen: true,
            title: "Shell",
            type: "shell",
            inputLabel: "Shell Thickness",
            defaultValue: -1,
            shell: { defaultValue: dimensionInputDialog.shell?.defaultValue ?? -1 },
            offset: { defaultValue: dimensionInputDialog.offset?.defaultValue ?? -1 },
            fillet: { defaultValue: dimensionInputDialog.fillet?.defaultValue ?? 1 },
          }
          setDimensionInputDialog(shellDialogState)
          setWSMActiveTool(FormIt.ToolType.SHELL_BODY)
          break
        }
        default:
          console.warn(`unknown tool ${tool}`)
      }
    })

    return () => {
      messageListener.dispose()
      resourceManager.dispose()
    }
  })
}
