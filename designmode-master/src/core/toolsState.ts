import { addBreadcrumb } from "@sentry/browser"
import type { FC } from "react"
import type { ReadonlySignal } from "@preact/signals"
import { computed, signal } from "@preact/signals"
import { isDefined } from "src/lib/array"
import { DesignModeEvents } from "./events/events"
import { pendingOperationSignal, setPendingOperationPreventedActionSignalValue } from "./pending-operation"
import { resetFadeAllExceptSignal } from "./selection/selectionState"

export type ToolCfg = {
  /**
   * id of the tool
   */
  id: string

  /**
   * The tool itself. Any functional component can be used.
   */
  tool: FC

  /**
   * Any functional component given will be rendered in the toolbar. If the string "topLevel" is used, the top level toolbar will be rendered.
   */
  toolbar: FC | "topLevel"

  /**
   * Custom component to render instead of the default properties in the right hand panel. If "default" is used, the standard panels will be shown.
   */
  propertyPanel: FC | "default"

  /**
   * Whether the tool needs WSM to be initialized before mounting the tool component
   */
  needsWSM?: boolean
}

interface IToolAPI {
  currentToolSignal: ReadonlySignal<ToolCfg>
  prevToolSignal: ReadonlySignal<ToolCfg>
  setTool(toolConfig: ToolCfg): void
  resetTool(): void
  setDefaultTool_INTERNAL(toolConfig: ToolCfg): void
}

const preventToolSwitch = {
  isBlockedSignal: computed(() => isDefined(pendingOperationSignal.value)),
  report: () => {
    setPendingOperationPreventedActionSignalValue({
      timestamp: Date.now(),
      description: (t) => t(($) => $.tools.pendingToolSwitchBlockedMessage),
    })
  },
}

const NO_OP_TOOL: ToolCfg = { id: "", tool: () => null, toolbar: "topLevel", propertyPanel: "default" }

function createToolAPI(prevent: typeof preventToolSwitch): IToolAPI {
  let defaultTool: ToolCfg = NO_OP_TOOL

  const prevToolSignal = signal<ToolCfg>(defaultTool)
  const currentToolSignal = signal<ToolCfg>(defaultTool)

  function setDefaultTool(toolConfig: ToolCfg) {
    defaultTool = toolConfig
    prevToolSignal.value = toolConfig
    currentToolSignal.value = toolConfig
  }

  function setTool(toolConfig: ToolCfg): void {
    if (prevent.isBlockedSignal.peek()) {
      return prevent.report()
    }
    prevToolSignal.value = currentToolSignal.value
    currentToolSignal.value = toolConfig

    addBreadcrumb({
      category: "Switch Tool",
      type: "user",
      timestamp: Date.now(),
      level: "info",
      data: { oldTool: prevToolSignal.peek().id, newTool: currentToolSignal.peek().id },
      message: `User switched active tool to ${currentToolSignal.peek().id}`,
    })
    DesignModeEvents.dispatch("tool.edit.start", { toolId: toolConfig.id })
  }

  function resetTool(): void {
    if (prevent.isBlockedSignal.peek()) {
      return prevent.report()
    }
    prevToolSignal.value = currentToolSignal.value
    currentToolSignal.value = defaultTool
    DesignModeEvents.dispatch("tool.edit.end")
  }

  return {
    currentToolSignal,
    prevToolSignal,
    setTool,
    resetTool,
    setDefaultTool_INTERNAL: setDefaultTool,
  }
}

export const toolAPI = createToolAPI(preventToolSwitch)

/**
 * Exits the currently active tool, reverting to the default (select). Also resets the edited element.
 */
export function exitCurrentTool() {
  toolAPI.resetTool()
  resetFadeAllExceptSignal()
}
