import type { FormaElement } from "forma-elements"
import { SOURCE_DESIGNMODE, PROPOSALS_UPDATED_EVENT, SCENARIO_UPDATED_EVENT } from "./constants"

type CustomEventDetail<T extends keyof WindowEventMap> = WindowEventMap[T] extends CustomEvent<infer U> ? U : never

export function dispatchProposalsUpdatedEvent(proposals: FormaElement[]) {
  window.dispatchEvent(
    new CustomEvent<CustomEventDetail<typeof PROPOSALS_UPDATED_EVENT>>(PROPOSALS_UPDATED_EVENT, {
      detail: { proposals, source: SOURCE_DESIGNMODE },
      bubbles: true,
      composed: true,
    }),
  )
}

export function dispatchScenarioUpdated(scenario: FormaElement) {
  window.dispatchEvent(
    new CustomEvent<CustomEventDetail<typeof SCENARIO_UPDATED_EVENT>>(SCENARIO_UPDATED_EVENT, {
      detail: { scenario, source: SOURCE_DESIGNMODE },
      bubbles: true,
      composed: true,
    }),
  )
}
