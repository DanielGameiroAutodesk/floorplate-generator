import { useComputed, useSignalEffect } from "@preact/signals"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { elementState } from "src/core/elements/ElementState"
import { DesignModeEvents } from "src/core/events/events"

export function useModelChangedEventTrigger() {
  // The snapshot updates on save which reuses the same root URN.
  // Isolate this effect so we only observe changed root URNs.
  const rootUrnSignal = useComputed(() => elementState.currentSnapshot.value.rootUrn)
  useSignalEffect(() => {
    if (!isAppInitializedSignal.value) return

    DesignModeEvents.dispatch("model.changed", { rootUrn: rootUrnSignal.value })
  })
}
