import styles from "./SubHeader.module.css"

export function SubHeader({ title }: { title: string }) {
  return <h2 className={styles.SubHeader}>{title}</h2>
}
