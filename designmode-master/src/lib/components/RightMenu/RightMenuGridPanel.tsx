import type { ComponentChildren } from "preact"
import styles from "./RightMenuGridPanel.module.pcss"

export function RightMenuGridPanel({
  children,
  style,
}: {
  children: ComponentChildren
  style?: JSX.HTMLAttributes["style"]
}) {
  return (
    <div className={styles.GridPanel} style={style}>
      {children}
    </div>
  )
}
