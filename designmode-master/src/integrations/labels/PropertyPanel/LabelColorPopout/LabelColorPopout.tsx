import { ClickOutside } from "src/lib/components/ClickOutside"
import { useState } from "preact/hooks"
import styles from "./LabelColorPopout.module.pcss"

export default function LabelColorPopout({
  isOpen,
  closeMenu,
  initialColor,
  setColor,
}: {
  isOpen: boolean
  closeMenu: () => void
  initialColor: string
  setColor: (color: string) => void
}) {
  const [localColor, setLocalColor] = useState(initialColor)
  return (
    <ClickOutside onClickOutside={closeMenu}>
      <weave-menu-container title={""} right={88} top={-45} open={isOpen}>
        {/* Hides the header */}
        <div slot="header" />

        <div className={styles.LabelColoursContainer}>
          {labelColors.map((c) => (
            <label key={c} data-active={c === localColor} className={styles.LabelColorChoice} style={{ color: c }}>
              <input
                type="radio"
                name={"color"}
                onChange={() => {
                  setLocalColor(c)
                  // Note: Keep this check. There is a bug where setColor sometimes is triggered when clicking in
                  // the right panel, even though the menu is not open.
                  if (isOpen) setColor(c)
                }}
                checked={c === localColor}
              />
            </label>
          ))}
        </div>
      </weave-menu-container>
    </ClickOutside>
  )
}

const labelColors = [
  "#222933",
  "#757575",
  "#CCCCCC",
  "#FFFFFF",
  "#D7CEBD",
  "#66513E",

  "#298080",
  "#58A060",
  "#B8E397",
  "#F8DD81",
  "#EA9C41",
  "#CF4C2D",

  "#006EAF",
  "#62CBF8",
  "#BFE7F8",
  "#F6DBDB",
  "#E0CDFC",
  "#7459A0",
]
