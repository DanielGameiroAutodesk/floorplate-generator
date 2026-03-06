import { proposalIdSignal } from "./proposal"
import {
  selectedBasePathsInProposalContextSignal,
  setContextRootSignal,
  setSelectionSetSignalValue,
} from "./selection/selectionState"
import { AnalyticsLegacy } from "./analytics"
import { scenarioHiddenSignal } from "./hidden"
import { elementState } from "./elements/ElementState"
import { batch } from "@preact/signals"

/**
 * Starts editing base 'sub-mode'.
 */
export function enterEditBase(e?: Event, stopPropagation: boolean = true) {
  const proposalId = proposalIdSignal.peek()
  if (stopPropagation && e) e.stopPropagation()
  const basePath = elementState.currentBasePathSignal.peek()
  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.peek()

  //TODO: Move to handler, do not track inside an API
  // Don't track this with new tracking schema.
  AnalyticsLegacy.track("Base - Edit", { proposalId })
  batch(() => {
    setContextRootSignal(basePath.value)
    scenarioHiddenSignal.value = false
    setSelectionSetSignalValue(selectedBasePathsInProposalContext)
  })
}
