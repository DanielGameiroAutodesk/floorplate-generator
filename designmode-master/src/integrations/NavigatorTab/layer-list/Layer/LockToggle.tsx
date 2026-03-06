import { Locked, Unlocked } from "src/integrations/NavigatorTab/layer-list/Icons"
import styles from "./LayerItem.module.pcss"

type Props = {
  locked: boolean
  toggleLock: (e: MouseEvent) => void
  name: string
  tooltip?: boolean
}

export const LockToggle = ({ locked, toggleLock, name, tooltip = true }: Props) => {
  return tooltip ? (
    <weave-tooltip text={`${locked ? "Unlock" : "Lock"} ${name}`} nub={"down-center"}>
      <button className={styles.LockToggle} onClick={toggleLock}>
        {locked ? <Locked /> : <Unlocked />}
      </button>
    </weave-tooltip>
  ) : (
    <button className={styles.LockToggle} onClick={toggleLock}>
      {locked ? <Locked /> : <Unlocked />}
    </button>
  )
}
