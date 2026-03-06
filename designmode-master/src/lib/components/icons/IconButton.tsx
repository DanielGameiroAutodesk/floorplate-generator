import type { VNode } from "preact"
import styles from "./IconButton.module.pcss"

export function IconButton(props: {
  text: string
  selected: boolean
  onClick: () => void
  children: VNode<any> | null
}) {
  return (
    <weave-tooltip
      className={styles.IconButton}
      style={props.selected ? `color: var(--icon-color-selected-default)` : undefined}
      text={props.text}
    >
      <button style={`all: unset;`} onClick={props.onClick}>
        {props.children}
      </button>
    </weave-tooltip>
  )
}
