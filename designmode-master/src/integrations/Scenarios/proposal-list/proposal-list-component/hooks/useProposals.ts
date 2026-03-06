import { type Dispatch, type StateUpdater, useCallback, useEffect, useState } from "preact/hooks"
import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"
import {
  getProposalById,
  getProposals,
} from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/ProposalElements"
import * as events from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import type { ProposalsUpdated } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import { parseUrn } from "src/lib/element/urn"
import type { Urn } from "forma-elements"
import { captureException } from "@sentry/browser"

type State = { status: "fetching" } | { status: "success"; data: ProposalElement[] } | { status: "error"; error: Error }
type SetProposals = Dispatch<StateUpdater<State>>
type UpdateProposals = (proposals: ProposalElement[]) => void

export function useProposals(projectId: string): {
  proposalState: State
  refetchProposals: () => void
  updateProposals: UpdateProposals
  deleteProposal: (urn: Urn) => void
} {
  const [proposalState, setProposals] = useState<State>({ status: "fetching" })

  const updateProposals = useCallback(
    (newProposals: ProposalElement[]) => {
      if (proposalState.status === "success") {
        const byId: Record<string, ProposalElement> = {}
        newProposals.forEach((proposal) => (byId[parseUrn(proposal.urn).id] = proposal))

        setProposals({
          status: "success",
          data: proposalState.data.map((proposal: ProposalElement) =>
            byId[parseUrn(proposal.urn).id] ? byId[parseUrn(proposal.urn).id] : proposal,
          ),
        })
      }
    },
    [proposalState, setProposals],
  )

  const deleteProposal = useCallback(
    (urn: Urn) => {
      if (proposalState.status === "success") {
        setProposals({
          status: "success",
          data: proposalState.data.filter(
            (proposal: ProposalElement) => parseUrn(proposal.urn).id !== parseUrn(urn).id,
          ),
        })
      }
    },
    [proposalState, setProposals],
  )

  const refetchProposals = useFetchProposals(projectId, setProposals)
  useSubscribeToWebsocket(projectId, updateProposals)

  return { proposalState, refetchProposals, updateProposals, deleteProposal }
}

function useFetchProposals(projectId: string, setProposals: SetProposals) {
  const fetchProposals = useCallback(() => {
    getProposals(projectId)
      .then((proposals) => setProposals({ status: "success", data: proposals }))
      .catch((error) => {
        captureException(error)
        setProposals({ status: "error", error })
      })
  }, [projectId, setProposals])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  return fetchProposals
}

function useSubscribeToWebsocket(projectId: string, updateProposals: UpdateProposals) {
  useEffect(() => {
    function onProposalsUpdated(e: CustomEvent<ProposalsUpdated>) {
      try {
        if (e.detail.source !== events.source) {
          updateProposals(e.detail.proposals)
        }
      } catch (e) {
        captureException(e)
      }
    }

    function onWebsocketMessage(e: CustomEvent) {
      void (async () => {
        if (e?.detail?.type === "forma/proposal/updated") {
          const proposal = await getProposalById(e.detail.proposalId, projectId)
          onProposalsUpdated(
            new CustomEvent(events.PROPOSALS_UPDATED, {
              detail: { proposals: [proposal], source: e.detail.source },
            }),
          )
        } else {
          console.log("received unknown message", e)
        }
      })()
    }

    window.addEventListener(events.PROPOSALS_UPDATED, onProposalsUpdated as EventListener)
    window.addEventListener("forma/websocket/event", onWebsocketMessage as EventListener)

    return () => {
      window.removeEventListener(events.PROPOSALS_UPDATED, onProposalsUpdated as EventListener)
      window.removeEventListener("forma/websocket/event", onWebsocketMessage as EventListener)
    }
  }, [projectId, updateProposals])
}
