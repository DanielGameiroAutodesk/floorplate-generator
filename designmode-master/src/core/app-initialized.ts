import { computed } from "@preact/signals"
import { elementState } from "./elements/ElementState"

export const isAppInitializedSignal = computed<boolean>(() => {
  return elementState.isInitializedSignal.value
})
