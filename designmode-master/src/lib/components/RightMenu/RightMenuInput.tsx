import type { ComponentChildren } from "preact"
import styles from "./RightMenuInput.module.pcss"

export function RightMenuInput({ children }: { children: ComponentChildren }) {
  return <div className={styles.Input}>{children}</div>
}
