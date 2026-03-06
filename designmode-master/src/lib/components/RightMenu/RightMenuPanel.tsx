import type { ComponentChildren } from "preact"
import styles from "./RightMenuPanel.module.pcss"

export function RightMenuPanel({
  children,
  style,
  id,
}: {
  children: ComponentChildren
  style?: JSX.HTMLAttributes["style"]
  id?: string
}) {
  return (
    <div className={styles.Panel} style={style} id={id}>
      {children}
    </div>
  )
}
