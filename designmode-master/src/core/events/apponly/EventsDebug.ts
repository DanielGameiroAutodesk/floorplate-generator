import type { DesignModeEventMap } from "src/core/events/events"
import { DesignModeEvents } from "src/core/events/events"
import { URLFlag, urlFlags } from "src/lib/featureToggling"

function listener(e: DesignModeEventMap[keyof DesignModeEventMap]) {
  console.groupCollapsed(`DMEvent: ${e.type}`)
  console.log(e.detail)
  console.groupEnd()
}

export function setupEventToasts() {
  if (urlFlags[URLFlag.DebugEvents]) {
    DesignModeEvents.addListener("tool.edit.start", listener)
    DesignModeEvents.addListener("tool.edit.end", listener)
    DesignModeEvents.addListener("test.event", listener)
    DesignModeEvents.addListener("selection.changed", listener)
    DesignModeEvents.addListener("model.changed", listener)
    DesignModeEvents.addListener("colorbar.range.changed", listener)
  }
}
