import type { ComponentChildren } from "preact"
import styles from "./RightMenuPanelContentGrid.module.pcss"

export function RightMenuPanelContentGrid({
  children,
  style,
}: {
  children: ComponentChildren
  style?: JSX.HTMLAttributes["style"]
}) {
  return (
    <div className={styles.PanelContentGrid} style={style}>
      {children}
    </div>
  )
}
