import styles from "./HistoryHeader.module.pcss"
import HistoryFilter from "./HistoryFilter/HistoryFilter"
import { elementState } from "src/core/elements/ElementState"
import { changeProposal } from "src/core/proposal-refresh"
import HistoryContributors from "./HistoryContributors/HistoryContributors"
import type { User } from "src/lib/users"

export default function HistoryHeader({ users, name }: { users: User[]; name?: string }) {
  return (
    <>
      <div className={styles.Header}>
        <div className={styles.HeaderGroup}>
          <weave-icon-button onClick={() => void changeProposal(elementState.currentProposalSignal.value.urn)}>
            <forma-icon-arrow-left slot="icon" />
          </weave-icon-button>
          <span>{name}</span>
        </div>
        <div className={styles.HeaderGroup}>
          <HistoryContributors users={users} />
          <HistoryFilter />
        </div>
      </div>
    </>
  )
}
