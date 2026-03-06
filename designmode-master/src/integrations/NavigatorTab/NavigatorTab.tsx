import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import LayerListWrapper, { LayerListWrapperSkeleton } from "./layer-list/LayerListWrapper"
import styles from "./NavigatorTab.module.css"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import type { Urn } from "@spacemakerai/element-types"
import { proposalIdSignal, revisionSignal } from "src/core/proposal"
import ProposalHistory from "src/integrations/proposal-history/ProposalHistory"
import { useCallback } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
import { clientId } from "src/core/client-id"
import { PROJECT_ID } from "src/core/project/project"
import { isAppInitializedSignal } from "src/core/app-initialized"
import * as proposalRefresh from "src/core/proposal-refresh"
import ProposalListContainer from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/ProposalListContainer"
import featureFlags from "src/lib/featureTogglingV2"
import useLazyLoadScript from "src/lib/useLazyLoadScript"

const FormaResizableSection = reactWcWrapper<any>("forma-resizable-section")
const FormaProposalList = reactWcWrapper<any>("forma-proposal-list")
const FormaProposalListSkeleton = reactWcWrapper<any>("forma-proposal-list-skeleton")

function ProposalList() {
  const proposalId = proposalIdSignal.value
  const snapshot = elementState.currentSnapshot.value
  const snapshotStatus = snapshot.status
  const scenarioFlag = featureFlags.scenarios.value
  const scenarioListLoaded = useLazyLoadScript(
    "/web-components/scenario-model-list/scenario-model-list.js",
    "design-mode",
  )

  const changeProposal = useCallback(
    (proposalUrn: Urn, revision?: string) => {
      if (snapshotStatus === ElementSnapshotStatus.InRecovery) {
        void proposalRefresh.changeProposalPageReload(proposalUrn, revision)
      } else {
        void proposalRefresh.changeProposal(proposalUrn, revision)
      }
    },
    [snapshotStatus],
  )

  if (scenarioFlag && scenarioListLoaded) {
    return (
      <ProposalListContainer
        projectid={PROJECT_ID}
        proposalelementid={proposalId}
        onproposalclick={changeProposal}
        clientId={clientId}
      />
    )
  }

  return (
    <FormaProposalList
      projectId={PROJECT_ID}
      proposalElementId={proposalId}
      onproposalclick={changeProposal}
      clientId={clientId}
    />
  )
}

export default function NavigatorTab() {
  const showProposalHistory = revisionSignal.value

  return (
    <div className={styles.Wrapper}>
      {showProposalHistory ? (
        <ProposalHistory />
      ) : (
        <>
          <FormaResizableSection default-height={400} min-height={40} max-height="calc(100% - 100px)">
            <StackBasedErrorBoundary stackPath={"proposal-list-v2"}>
              <>{isAppInitializedSignal.value && <ProposalList />}</>
            </StackBasedErrorBoundary>
          </FormaResizableSection>
          {isAppInitializedSignal.value && <LayerListWrapper />}
        </>
      )}
    </div>
  )
}

export function NavigatorTabSkeleton() {
  return (
    <div className={styles.Wrapper}>
      <FormaResizableSection default-height={400} min-height={40} max-height="calc(100% - 100px)">
        <StackBasedErrorBoundary stackPath={"proposal-list-v2"}>
          <FormaProposalListSkeleton />
        </StackBasedErrorBoundary>
      </FormaResizableSection>
      <LayerListWrapperSkeleton />
    </div>
  )
}
