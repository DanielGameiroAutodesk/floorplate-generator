import HistoryHeader from "src/integrations/proposal-history/HistoryHeader/HistoryHeader"
import { ProviderItemLoadingSkeleton } from "./ProviderItemLoadingSkeleton"
import styles from "./Skeleton.module.pcss"
import type { User } from "src/lib/users"

export const ProposalHistorySkeleton = ({ users }: { users: User[] }) => {
  return (
    <>
      <div className={styles.SkeletonHeaderWrapper}>
        <HistoryHeader users={users} />
      </div>
      <div className={styles.SkeletonContainer}>
        <ProviderItemLoadingSkeleton />
        <ProviderItemLoadingSkeleton />
        <ProviderItemLoadingSkeleton />
        <ProviderItemLoadingSkeleton />
        <ProviderItemLoadingSkeleton />
        <ProviderItemLoadingSkeleton />
      </div>
    </>
  )
}
