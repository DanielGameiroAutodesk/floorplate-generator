import type { TrackingData } from "src/core/analytics"
import { AnalyticsUtils } from "src/core/analytics"
import { selectionSetSignal } from "./selectionState"
import { uniq } from "src/lib/array"
import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"

export const partialTrackingDataForSelectionSignal = computed<Pick<TrackingData, "elementCategory" | "numElements">>(
  () => {
    const toplevel = elementState.currentProposalSignal.value.getToplevelNodes()
    const selected = selectionSetSignal.value
    const selectedElements = toplevel.filter((e) => selected.has(e.path))
    const elementCategory = AnalyticsUtils.trackedElementCategory(
      selectedElements.map((e) => e.elementContainer.mappedCategory),
    )

    const scenarioState = uniq(selectedElements.map((e) => e.isInBase))

    return {
      elementCategory,
      numElements: selectedElements.length,
      inScenario: AnalyticsUtils.trackedInScenarioFlag(scenarioState),
    }
  },
)
