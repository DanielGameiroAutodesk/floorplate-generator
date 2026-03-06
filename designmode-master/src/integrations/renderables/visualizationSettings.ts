import { explicitSignal } from "src/lib/signal"
import type { VisualizationSettings } from "src/lib/visualizationSettings"

let cache: undefined | VisualizationSettings
const val = localStorage.getItem("forma-visualization-settings")
try {
  if (val) {
    const parsed = JSON.parse(val) as VisualizationSettings
    cache = {
      buildings: {
        mode: parsed.buildings.mode,
        areaSizeBuckets: parsed.buildings.areaSizeBuckets || [],
        functionColors: parsed.buildings.functionColors,
      },
    }
  }
} catch (e) {
  console.warn("failed to parse local storage key forma-visualization-settings", e)
}

export const [visualizationSettingsSignal, setVisualizationSettingsSignalValue] = explicitSignal<VisualizationSettings>(
  cache || {
    buildings: {
      mode: "functions",
      functionColors: {},
      areaSizeBuckets: [],
    },
  },
)

let i = 0
visualizationSettingsSignal.subscribe((newVal) => {
  // Skip initial value.
  if (i++ === 0) return

  localStorage.setItem("forma-visualization-settings", JSON.stringify(newVal))
})
