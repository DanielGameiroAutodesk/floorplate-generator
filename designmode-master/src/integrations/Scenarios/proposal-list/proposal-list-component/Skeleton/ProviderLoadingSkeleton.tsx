import { ProviderItemLoadingSkeleton } from "./ProviderItemLoadingSkeleton"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"

export function ProviderLoadingSkeleton() {
  return (
    <div className={styles.skeletonContainer}>
      <ProviderItemLoadingSkeleton />
      <ProviderItemLoadingSkeleton />
      <ProviderItemLoadingSkeleton />
      <ProviderItemLoadingSkeleton />
      <ProviderItemLoadingSkeleton />
      <ProviderItemLoadingSkeleton />
    </div>
  )
}
