import type { ComponentChildren } from "preact"
import styles from "./ExploreMenu.module.pcss"

function IconDot(props: JSX.HTMLAttributes<SVGSVGElement>) {
  return (
    <svg {...props} width="4" height="4" viewBox="0 0 4 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="2" cy="2" r="2" fill="#38ABDF" />
    </svg>
  )
}

export function IconButton({
  icon,
  selected,
  onClick,
  key,
  disabled,
  dot,
}: {
  icon: JSX.Element
  selected: boolean
  onClick?: () => void
  key?: string
  disabled?: boolean
  dot?: boolean
}) {
  return (
    <div
      key={key}
      className={`${styles.IconButton} ${selected ? styles.selected : ""}`}
      onClick={(e) => {
        if (!onClick) return
        e.preventDefault()
        if (disabled) return
        onClick()
      }}
      disabled={disabled}
    >
      {icon}
      {dot && <IconDot style={{ position: "absolute", top: "5px", right: "5px" }} />}
    </div>
  )
}

export function IconButtonGroup({ children }: { children: ComponentChildren }) {
  return <div className={styles.IconButtonGroup}>{children}</div>
}

export function PreviewTile({
  children,
  selected,
  onClick,
  disabled,
}: {
  children: ComponentChildren
  selected: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={`${styles.PreviewTile} ${selected ? styles.selected : ""}`}
      onClick={(e) => {
        if (!onClick) return
        e.preventDefault()
        if (disabled) return
        onClick()
      }}
      disabled={disabled}
    >
      {children}
    </div>
  )
}

export function PreviewTileWrapper({ children }: { children: ComponentChildren }) {
  return <div className={styles.PreviewTileWrapper}>{children}</div>
}
