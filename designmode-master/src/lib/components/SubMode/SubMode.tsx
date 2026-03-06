import styles from "./styles.module.pcss"
import { useMemo } from "preact/compat"
import type { ComponentChildren } from "preact"
import combineClasses from "src/lib/combineClasses"

type SubMode = "base" | "add"

function SubModeComponent({ mode, children }: { mode: SubMode; children: ComponentChildren }) {
  const colorConfig = useMemo(() => {
    switch (mode) {
      case "base":
        return styles.ModeScenario
      case "add":
        return styles.ModeAdd
    }
  }, [mode])

  return (
    <div className={colorConfig}>
      <div className={combineClasses([styles.Border, styles.NavbarOffset])}></div>
      <div className={combineClasses([styles.TopBanner, styles.NavbarOffset])}>{children}</div>
    </div>
  )
}

export default SubModeComponent
