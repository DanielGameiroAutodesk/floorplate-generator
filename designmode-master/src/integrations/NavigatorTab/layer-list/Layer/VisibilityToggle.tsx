import styles from "./LayerItem.module.pcss"
import { EyeHidden, EyeVisible } from "src/integrations/NavigatorTab/layer-list/Icons"

type Props = {
  hidden: boolean
  toggleVisible: (e: MouseEvent) => void
  name: string
  tooltip?: boolean
  onMouseOver?: (e: MouseEvent) => void
  onMouseOut?: (e: MouseEvent) => void
}

export const VisibilityToggle = ({ hidden, toggleVisible, name, onMouseOver, onMouseOut, tooltip = true }: Props) => {
  return tooltip ? (
    <weave-tooltip text={`${hidden ? "Show" : "Hide"} ${name}`} nub="down-center">
      <div
        className={styles.VisibilityToggle}
        onClick={toggleVisible}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
      >
        {hidden ? <EyeHidden /> : <EyeVisible />}
      </div>
    </weave-tooltip>
  ) : (
    <div className={styles.VisibilityToggle} onClick={toggleVisible} onMouseOver={onMouseOver} onMouseOut={onMouseOut}>
      {hidden ? <EyeHidden /> : <EyeVisible />}
    </div>
  )
}
