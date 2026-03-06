import { useCallback } from "preact/hooks"
import type { Urn } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import type { RevisionMetadataBody } from "src/core/proposal-element-system/ProposalClient"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { AnalyticsLegacy } from "src/core/analytics"
import { useSetRecoilState } from "recoil"
import { revisionMetadataState } from "src/integrations/proposal-history/proposal-history-state"
import { PROJECT_ID } from "src/core/project/project"
import { proposalIdSignal } from "src/core/proposal"

export function usePinRevisions(): {
  fetchPinnedRevisions: () => void
  addRevisionMetadata: (revisionUrn: Urn, body: RevisionMetadataBody) => void
} {
  const setRevisionMetadata = useSetRecoilState(revisionMetadataState)
  const fetchPinnedRevisions = useCallback(() => {
    ProposalClientV3.getAllMetadataForProposal(proposalIdSignal.peek(), PROJECT_ID)
      .then((revMetadata) => {
        setRevisionMetadata(revMetadata)
      })
      .catch(() => {
        window.forma_toasts.push({
          content: `Failed to get all metadata for the proposal`,
          status: "error",
        })
      })
  }, [setRevisionMetadata])

  const addRevisionMetadata = useCallback(
    (revisionUrn: Urn, body: RevisionMetadataBody) => {
      ProposalClientV3.addRevisionMetadata(proposalIdSignal.peek(), parseUrn(revisionUrn).revision, PROJECT_ID, body)
        .then((response) => {
          if (response) {
            fetchPinnedRevisions()
          }
        })
        .catch(() => {
          window.forma_toasts.push({
            content: `Failed to add metadata to revision`,
            status: "error",
          })
        })
      // Don't track this with new tracking schema
      AnalyticsLegacy.track("Proposal history - Add metadata to version")
    },
    [fetchPinnedRevisions],
  )

  return { fetchPinnedRevisions, addRevisionMetadata }
}
