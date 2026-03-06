import styles from "./Skeleton.module.pcss"

export const ProviderItemLoadingSkeleton = () => {
  return (
    <div className={styles.SkeletonItem}>
      <weave-skeleton-item height="10px" width="20px" radius="4px" />
      <weave-skeleton-item height="10px" width="170px" radius="4px" />
    </div>
  )
}
