import type { Urn } from "forma-elements"
import { useCallback, useState } from "preact/hooks"
import { createNewProposalWithTerrain } from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/ProposalElements"
import { captureException } from "@sentry/browser"
import analytics from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/analytics"
import { useTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

function trackAndIgnoreError(projectId: string, event: string) {
  try {
    analytics.track(projectId, event)
  } catch (e) {
    captureException(e)
  }
}

export function CreateProposal({
  projectId,
  proposalElementId,
  onCreateNewProposal,
  disabled,
}: {
  projectId: string
  proposalElementId: string | undefined
  onCreateNewProposal: (urn: Urn) => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const [pending, setPending] = useState(false)
  const create = useCallback(async () => {
    if (!proposalElementId) return
    setPending(true)
    try {
      trackAndIgnoreError(projectId, "Proposal - Create new")
      const proposal = await createNewProposalWithTerrain(projectId, proposalElementId)
      if (proposal) {
        onCreateNewProposal(proposal.urn)
      }
    } catch (e) {
      captureException(e)
    } finally {
      setPending(false)
    }
  }, [onCreateNewProposal, proposalElementId, projectId])

  return (
    <weave-tooltip nub="down-center" text={t(($) => $.createProposal.buttonTooltip)}>
      <weave-icon-button onClick={() => !pending && void create()} disabled={disabled}>
        <svg
          slot="icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ cursor: pending ? "progress" : "pointer" }}
        >
          <path fillRule="evenodd" clipRule="evenodd" d="M7 7V2H8V7H13V8H8V13H7V8H2V7H7Z" fill="#808080" />
        </svg>
      </weave-icon-button>
    </weave-tooltip>
  )
}
