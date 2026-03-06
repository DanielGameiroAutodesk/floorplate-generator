import type { ComponentChildren } from "preact"
import styles from "./BorderContainer.module.css"

export function BorderContainer({ children }: { children: ComponentChildren }) {
  return <div className={styles.Container}>{children}</div>
}
