/**
 * Proposal List Component - Main Export
 *
 * This is the main entry point for the extracted Proposal List component.
 * Import the component directly from this file for easier integration.
 *
 * @example
 * ```tsx
 * import { ProposalListContainer } from './proposal-list-component';
 *
 * <ProposalListContainer
 *   projectId="your-project-id"
 *   proposalElementId="urn:adsk.dtt:your-proposal-element-id"
 *   clientId="my-app"
 * />
 * ```
 */

// Main component export
export { default as ProposalListContainer } from "./ProposalList/ProposalListContainer"

// Re-export hooks for advanced usage
export { useProposals } from "./hooks/useProposals"
export { useScenarios } from "./hooks/useScenarios"
export { useProjectRole } from "./hooks/useProjectRole"
export { useActiveConnections } from "./hooks/useActiveConnections"

// Re-export types
export type { ProposalElement } from "./ProposalList/types"

// Re-export context for advanced usage
export { default as ProjectIdContext } from "./Context/ProjectIdContext"
