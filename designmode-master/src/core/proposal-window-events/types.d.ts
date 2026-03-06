import type { FormaElement } from "forma-elements"
import type {
  PROPOSAL_UPDATED_EVENT,
  PROPOSALS_UPDATED_EVENT,
  PROPOSALS_WEBSOCKET_EVENT,
  SCENARIO_UPDATED_EVENT,
} from "./constants"

// See also https://github.com/spacemakerai/proposal-list-v2

declare global {
  interface WindowEventMap {
    [PROPOSAL_UPDATED_EVENT]: CustomEvent<{ proposalId: string; source: string }>
    [PROPOSALS_UPDATED_EVENT]: CustomEvent<{ proposals: FormaElement[]; source: string }>
    // See https://github.com/spacemakerai/proposal-list-v2/blob/8c55f0b1170f67312e56e5d4cb2b18f98537fcdc/src/utils/websocketBusinessLogic.ts#L180
    [PROPOSALS_WEBSOCKET_EVENT]: CustomEvent
    [SCENARIO_UPDATED_EVENT]: CustomEvent<{ source: string; scenario: FormaElement }>
  }
}
