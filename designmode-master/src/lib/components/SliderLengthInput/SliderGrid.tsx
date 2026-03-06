import type { ComponentChildren } from "preact"
import styles from "./SliderGrid.module.pcss"

export default function SliderGrid({ children }: { children: ComponentChildren }) {
  return <div className={styles.SliderGrid}>{children}</div>
}
