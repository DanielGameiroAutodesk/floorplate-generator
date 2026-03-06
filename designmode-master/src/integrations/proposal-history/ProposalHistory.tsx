import { useCallback, useEffect } from "preact/hooks"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import styles from "./ProposalHistory.module.pcss"
import fetchAnalyzedRevisions from "./utils/fetchAnalyzedRevisions"
import { fetchUniqueUsersFromRevisions } from "./utils/fetchUsers"
import HistoryHeader from "./HistoryHeader/HistoryHeader"
import { usePinRevisions } from "./utils/usePinRevisions"
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil"
import {
  analyzedRevisionsState,
  baseElementToRevision,
  latestRevisionState,
  periodsByDayState,
  proposalRevisionsState,
  revisionUsersState,
} from "./proposal-history-state"
import { ProposalHistorySkeleton } from "./Skeleton/ProposalHistorySkeleton"
import RevisionTile from "./RevisionTile/RevisionTile"
import SectionDayTile from "./SectionTile/SectionDayTile"
import { useListenToTriggeredAnalyses } from "./utils/useListenToTriggeredAnalyses"
import { PROJECT_ID } from "src/core/project/project"
import { projectSignal } from "src/core/project/project"
import { proposalIdSignal } from "src/core/proposal"

export default function ProposalHistory() {
  const currentProject = projectSignal.value
  const [revisionUsers, setRevisionsUsers] = useRecoilState(revisionUsersState)
  const { fetchPinnedRevisions } = usePinRevisions()

  const setAnalyzedRevisions = useSetRecoilState(analyzedRevisionsState)
  const setProposalRevisions = useSetRecoilState(proposalRevisionsState)
  const periodsByDay = useRecoilValue(periodsByDayState)
  const [latestRevision, setLatestRevision] = useRecoilState(latestRevisionState)

  useListenToTriggeredAnalyses()

  const loadRevisionsData = useCallback(() => {
    void ProposalClientV3.listRevisionsForProposal(proposalIdSignal.peek(), PROJECT_ID).then(async (revisions) => {
      const users = await fetchUniqueUsersFromRevisions(revisions, currentProject?.customerId)
      const analyzedRevisions = await fetchAnalyzedRevisions(proposalIdSignal.peek(), PROJECT_ID)

      if (revisions.length) {
        setLatestRevision(baseElementToRevision({ elm: revisions[0], users }))
      }

      fetchPinnedRevisions()
      setProposalRevisions(revisions.slice(1, revisions.length))
      setRevisionsUsers(users)
      setAnalyzedRevisions(analyzedRevisions)
    })
  }, [
    currentProject?.customerId,
    fetchPinnedRevisions,
    setAnalyzedRevisions,
    setLatestRevision,
    setProposalRevisions,
    setRevisionsUsers,
  ])

  useEffect(loadRevisionsData, [loadRevisionsData])

  if (!periodsByDay.length && !latestRevision) return <ProposalHistorySkeleton users={[]} />

  return (
    <div className={styles.ProposalHistory}>
      <HistoryHeader users={revisionUsers} name={latestRevision?.name} />
      <div className={styles.SectionsWrapper}>
        {latestRevision && <RevisionTile revision={latestRevision} current first />}
        {periodsByDay.length > 0 &&
          periodsByDay.map((periodsForDay, i) => (
            <SectionDayTile
              periodsForDay={periodsForDay}
              key={periodsForDay[0][0].urn}
              last={i === periodsByDay.length - 1}
            />
          ))}
      </div>
    </div>
  )
}
