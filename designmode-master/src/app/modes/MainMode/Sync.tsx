import { useCallback, useEffect } from "preact/hooks"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import { getRepresentationsByUrn } from "src/core/elements-loading/loading"
import { getElementsWithChildren } from "src/core/elements-loading/elementFetching"
import { SavingConflictModal } from "src/core/elements-saving/SavingConflictModal"
import { viewRevisionSignal } from "src/core/proposal"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { elementState } from "src/core/elements/ElementState"
import { elementContainerTreeFromObjects } from "src/core/elements/elementContainersFromObjects"
import { analyticsAndBreadcrumbsForActions } from "src/core/analytics"
import { FormaElementBox } from "src/lib/element/statebox"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { getInMapOrThrow } from "src/lib/map"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import {
  PROPOSAL_UPDATED_EVENT,
  PROPOSALS_WEBSOCKET_EVENT,
  SOURCE_DESIGNMODE,
} from "src/core/proposal-window-events/constants"

const WEBSOCKET_LIVE = new URLSearchParams(window.location.search).has("live")

type SyncProps = {
  createNewProposal: (element: FormaElement, authcontext: string) => Promise<FormaElement>
}

export default function Sync({ createNewProposal }: SyncProps) {
  const isViewingCurrentRevision = viewRevisionSignal.value === "current"

  // TODO: This does not support terrain updates.
  const updateProposal = useCallback(
    (source: string, proposalUrn: Urn, elements: Map<Urn, FormaElementBox>, representations: RepresentationsByUrn) => {
      const currentRootUrn = elementState.currentSnapshot.peek().rootUrn
      if (parseUrn(currentRootUrn).id !== parseUrn(proposalUrn).id) {
        console.warn("Proposal has changed in the mean time")
        return
      }
      // don't track this with new tracking schema
      analyticsAndBreadcrumbsForActions(`Update proposal from library. (Triggered by ${source})`)
      elementState.updateProposal(
        elementContainerTreeFromObjects(
          proposalUrn,
          elements,
          representations,
          elementState.currentSnapshot.peek().elements,
        ),
      )
    },
    [],
  )

  const setProposal = useCallback(
    async (proposalBox: FormaElementBox, source: string) => {
      // rootUrn can have been changed while fetching the proposal, need to check again.
      const snapshot = elementState.currentSnapshot.peek()
      const afterFetchRootBox = snapshot.rootNode.elementContainer.toFormaElementBox()
      const elements = snapshot.getFormaElementBoxes()

      const proposal = proposalBox.element

      if (parseUrn(afterFetchRootBox.element.urn).id !== parseUrn(proposal.urn).id) {
        console.warn("Proposal has changed in the mean time asdasda")
        return
      }

      if (!afterFetchRootBox.isServerState) {
        // do not do anything; saving conflict modal will show after local design mode will try to save changes
        return
      }
      const notLoadedChildren = proposal.children?.filter((child) => !elements.has(child.urn))
      if (notLoadedChildren && notLoadedChildren.length > 0) {
        const allElements = await getElementsWithChildren([proposal.urn])
        const newElements = new Map(Array.from(allElements).filter(([urn]) => !elements.has(urn)))
        const representations = await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(newElements))
        updateProposal(source, proposal.urn, newElements, representations)
      } else {
        updateProposal(source, proposal.urn, new Map([[proposal.urn, proposalBox]]), {
          volumeMesh: new Map(),
          footprint: new Map(),
          terrainShape: new Map(),
          terrainTexture: new Map(),
          buildingFloors3DSketch_UNSTABLE: new Map(),
        })
      }
    },
    [updateProposal],
  )

  const handler = useCallback(
    (e: WindowEventMap[typeof PROPOSAL_UPDATED_EVENT]) => {
      async function run() {
        const { proposalId, source } = e.detail
        if (source === SOURCE_DESIGNMODE) return

        const initialRootUrn = elementState.currentSnapshot.peek().rootUrn
        if (parseUrn(initialRootUrn).id !== proposalId) {
          console.warn("The changed proposal is not the same as the current proposal, do nothing")
          return
        }

        const authcontext = parseUrn(initialRootUrn).authcontext
        const proposalResponse = await ProposalClientV3.get(proposalId, authcontext)
        const proposal = FormaElementBox.fromServer(
          getInMapOrThrow(proposalResponse.response, proposalResponse.rootUrn),
        )

        await setProposal(proposal, source)
      }
      void run()
    },
    [setProposal],
  )

  const onWebsocketEvent = useCallback(
    (e: CustomEvent) => {
      if (e.detail.type === PROPOSAL_UPDATED_EVENT) {
        if (WEBSOCKET_LIVE) {
          handler(e)
        }
      }
    },
    [handler],
  )

  useEffect(() => {
    if (!isViewingCurrentRevision) return
    window.addEventListener(PROPOSAL_UPDATED_EVENT, handler)

    if (WEBSOCKET_LIVE) {
      window.addEventListener(PROPOSALS_WEBSOCKET_EVENT, onWebsocketEvent)
    }
    return () => {
      window.removeEventListener(PROPOSAL_UPDATED_EVENT, handler)
      if (WEBSOCKET_LIVE) {
        window.removeEventListener(PROPOSALS_WEBSOCKET_EVENT, onWebsocketEvent)
      }
    }
  }, [handler, isViewingCurrentRevision, onWebsocketEvent])

  return <SavingConflictModal createNewProposal={createNewProposal} />
}
