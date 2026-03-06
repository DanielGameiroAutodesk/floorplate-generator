import type { ComponentChildren } from "preact"
import styles from "./RightMenuPanelContainer.module.pcss"

export function RightMenuPanelContainer({
  children,
  style,
}: {
  children: ComponentChildren
  style?: JSX.HTMLAttributes["style"]
}) {
  return (
    <div className={styles.PanelContainer} style={style}>
      {children}
    </div>
  )
}
