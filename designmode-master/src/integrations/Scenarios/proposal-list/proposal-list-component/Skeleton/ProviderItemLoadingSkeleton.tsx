import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"

export function ProviderItemLoadingSkeleton() {
  return (
    <div className={styles.skeletonItem}>
      <weave-skeleton-item height="56px" width="56px" radius="0px" />
      <div className={styles.skeletonHeader}>
        <weave-skeleton-item height="7px" width="53px" radius="4px" />
        <weave-skeleton-item height="7px" width="35px" radius="100px" />
      </div>
    </div>
  )
}
