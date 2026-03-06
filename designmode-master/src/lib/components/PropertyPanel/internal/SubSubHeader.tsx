import styles from "./SubSubHeader.module.css"

export function SubSubHeader({ title }: { title: string }) {
  return <h2 className={styles.SubHeader}>{title}</h2>
}
