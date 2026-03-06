import type { FormaElement, Properties } from "forma-elements"

export type ProposalElement = FormaElement & {
  properties?: Properties & {
    category?: "proposal"
    name?: string
    flags: {
      [key: string]: {
        scenario?: boolean
      }
    }
    scenario?: {
      accProjectId: string
      fileUrn: string
      scenarioId: string
    }
  }
}
