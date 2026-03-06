import { setVisualizationSettingsSignalValue, visualizationSettingsSignal } from "./visualizationSettings"
import type { VisualizationSettings } from "src/lib/visualizationSettings"
import { computed } from "@preact/signals"

interface VisualizationAPI {
  settings: VisualizationSettings
  updateSettings: (s: VisualizationSettings | ((s: VisualizationSettings) => VisualizationSettings)) => void
}

const visualizationApiSignal = computed<VisualizationAPI>(() => {
  return {
    settings: visualizationSettingsSignal.value,
    updateSettings: setVisualizationSettingsSignalValue,
  }
})

export function useVisualizationAPI(): VisualizationAPI {
  return visualizationApiSignal.value
}
