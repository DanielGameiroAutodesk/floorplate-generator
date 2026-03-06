import type { Category } from "src/core/categories"
import styles from "./LayerItem.module.pcss"
import { resetHoveredIdsSignal } from "src/core/selection/selectionState"
import { VisibilityToggle } from "./VisibilityToggle"
import { LockToggle } from "./LockToggle"
import { allCategories } from "src/integrations/NavigatorTab/layer-list/LayerListCategorized"
import Spinner from "src/lib/components/icons/Spinner"

type Props = {
  title: string
  category: Category
  hidden: boolean
  locked: boolean
  selected: boolean
  hovered: boolean
  pending?: boolean
  disabled?: boolean
  isScenario: boolean
  onClick: (e: MouseEvent) => void
  onMouseOver: (e: MouseEvent) => void
  onContextMenu: (e: MouseEvent) => void
  toggleLock: (e: MouseEvent) => void
  toggleVisible: (e: MouseEvent) => void
  numberOfElements?: number
  isSubLayer?: boolean
  id?: string
}

export const LayerItem = ({
  title,
  category,
  hidden,
  locked,
  selected,
  hovered,
  pending,
  disabled,
  isScenario,
  onClick,
  onMouseOver,
  onContextMenu,
  toggleLock,
  toggleVisible,
  numberOfElements,
  id,
  isSubLayer = false,
}: Props) => {
  const { Icon } = allCategories[category]
  const isBuildingInBase = category === "building" && isScenario

  return (
    <div
      id={id}
      className={[
        styles.LayerItem,
        isScenario ? styles.BaseLayer : "",
        hovered ? styles.Hovered : " ",
        selected ? styles.Selected : " ",
        locked ? styles.locked : "",
        hidden ? styles.hidden : "",
        disabled ? styles.disabled : "",
      ].join(" ")}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={resetHoveredIdsSignal}
      onContextMenu={onContextMenu}
      data-tutorial-target={isBuildingInBase ? "buildings-in-base-layer" : undefined}
    >
      <div className={styles.Icon}>
        <Icon />
      </div>
      <div className={styles.Title}>{numberOfElements && hovered ? `${title} (${numberOfElements})` : title}</div>
      <div className={styles.Buttons}>
        <LockToggle name={title} toggleLock={toggleLock} locked={locked} tooltip={!isSubLayer} />
        <VisibilityToggle name={title} toggleVisible={toggleVisible} hidden={hidden} tooltip={!isSubLayer} />
        {pending && <Spinner />}
      </div>
    </div>
  )
}
