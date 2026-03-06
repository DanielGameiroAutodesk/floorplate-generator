import { useCallback, useRef, useState } from "preact/hooks"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { captureException } from "@sentry/browser"
import { changeProposal } from "src/core/proposal-refresh"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { AnalyticsLegacy } from "src/core/analytics"
import { getElementsClient } from "src/core/elements-loading/loading"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import { GroupClient } from "src/integrations/group-element-system/client"
import styles from "./BranchMenu.module.pcss"
import { useRecoilValue } from "recoil"
import { latestRevisionState } from "src/integrations/proposal-history/proposal-history-state"
import { findBaseChild } from "src/lib/element/base"
import { dispatchProposalsUpdatedEvent } from "src/core/proposal-window-events/dispatchers"
import { getTranslator, useTranslator } from "src/i18n"

async function usesSameBase(urnA: Urn, urnB: Urn): Promise<boolean> {
  const { element: latestProposal } = await getElementsClient().getElementAutoBatched(urnA)
  const { element: revisionProposal } = await getElementsClient().getElementAutoBatched(urnB)

  const proposalBaseA = findBaseChild(latestProposal)
  const proposalBaseB = findBaseChild(revisionProposal)

  return proposalBaseA?.urn === proposalBaseB?.urn
}

async function branchProposal(proposalRevision: Urn): Promise<{ proposal: FormaElement; base: FormaElement } | null> {
  try {
    // Safest to fetch an extra time as user can potentially branch out of a revision that is not currently selected
    const { element: proposal } = await getElementsClient().getElementAutoBatched(proposalRevision)

    const childBase = findBaseChild(proposal)
    if (!childBase) throw new Error("Failed to find base in proposal")

    const { element: baseAtRevision } = await getElementsClient().getElementAutoBatched(childBase.urn)

    const branchedBase = await GroupClient.branchBase(baseAtRevision)
    const branchedProposal = await ProposalClientV3.branch(proposal.urn, branchedBase.urn)

    return { proposal: branchedProposal, base: branchedBase }
  } catch (e) {
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.proposalHistory.branchFailed),
      status: "error",
    })
    captureException(e)
    return null
  }
}

export default function BranchMenuItem({ revisionUrn }: { revisionUrn: Urn }) {
  const t = useTranslator()
  const latestRevision = useRecoilValue(latestRevisionState)

  const modalRef = useRef<WeaveModalElement | null>(null)
  const [baseStrategy, setBaseStrategy] = useState<"latest" | "revision">("latest")

  const cloneRevision = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      if (baseStrategy === "latest") {
        void ProposalClientV3.duplicateRevision(revisionUrn).then((proposal) => {
          dispatchProposalsUpdatedEvent([proposal])
          void changeProposal(proposal.urn)
          const t = getTranslator()
          window.forma_toasts.push({
            status: "success",
            content: t(($) => $.proposalHistory.branchSuccess, { name: proposal.properties!.name }),
            autoDismiss: true,
          })
          // Don't track this with new tracking schema
          AnalyticsLegacy.track("Proposal history - Branch from old version", { strategy: baseStrategy })
        })
      } else if (baseStrategy === "revision") {
        void branchProposal(revisionUrn).then((branched) => {
          if (branched?.base && branched?.proposal) {
            dispatchProposalsUpdatedEvent([branched.proposal])
            void changeProposal(branched.proposal.urn)
            window.forma_toasts.push({
              status: "success",
              content: `A new proposal and base have been created from the chosen version with the name "${
                branched.proposal.properties!.name
              }" and "${branched.base.properties!.name}".`,
              autoDismiss: true,
            })
            // Don't track this with new tracking schema
            AnalyticsLegacy.track("Proposal history - Branch from old version", { strategy: baseStrategy })
          }
        })
      }
    },
    [baseStrategy, revisionUrn],
  )

  const onClickCreateNewProposal = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()

      async function run() {
        if (latestRevision) {
          const sameBase = await usesSameBase(latestRevision.urn, revisionUrn)
          if (sameBase) {
            setBaseStrategy("latest")
            cloneRevision(e)
            return
          }
        }

        modalRef.current?.show()
      }
      void run()
    },
    [cloneRevision, latestRevision, revisionUrn],
  )

  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.proposalHistory.branchRevisionButton)}
        onClick={onClickCreateNewProposal}
      />
      <weave-modal ref={modalRef}>
        <h1 slot="title" className={styles.Header}>
          {t(($) => $.base.strategy.header)}
        </h1>
        <div slot="content" className={styles.ContentWrapper}>
          <div className={styles.Description}>
            <forma-info-16 /> {t(($) => $.base.strategy.description)}
          </div>
          <weave-radio-button-group>
            <weave-radio-button
              value="latest"
              label={t(($) => $.base.strategy.useLatest)}
              checked={"latest" === baseStrategy}
              onChange={() => setBaseStrategy("latest")}
            ></weave-radio-button>
            <weave-radio-button
              value="revision"
              label={t(($) => $.base.strategy.duplicateOld)}
              checked={"revision" === baseStrategy}
              onChange={() => setBaseStrategy("revision")}
            ></weave-radio-button>
          </weave-radio-button-group>
        </div>
        <div slot="actions" className={styles.Actions}>
          <weave-button onClick={() => modalRef?.current?.close()} variant="flat">
            {t(($) => $.ui.cancel)}
          </weave-button>
          <weave-button onClick={cloneRevision} variant="solid">
            {t(($) => $.proposalHistory.branchRevisionButton)}
          </weave-button>
        </div>
      </weave-modal>
    </>
  )
}
