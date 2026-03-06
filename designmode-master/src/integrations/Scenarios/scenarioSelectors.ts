import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"

/**
 * Selector to extract scenario information from the current proposal
 * Returns accProjectId, fileUrn, and scenarioId if they exist on the proposal
 */
export const proposalScenarioInfoSignal = computed<
  | {
      accProjectId: string
      scenarioId: string
      fileUrn: string
    }
  | undefined
>(() => {
  // Guard against uninitialized state
  if (!elementState.isInitializedSignal.value) {
    return undefined
  }

  const proposal = elementState.currentProposalSignal.value
  const scenarioInfo = proposal.element.properties.scenario

  if (scenarioInfo) {
    return {
      accProjectId: scenarioInfo.accProjectId,
      scenarioId: scenarioInfo.scenarioId,
      fileUrn: scenarioInfo.fileUrn,
    }
  }

  return undefined
})

export const isInScenarioSignal = computed<boolean>(() => !!proposalScenarioInfoSignal.value)
