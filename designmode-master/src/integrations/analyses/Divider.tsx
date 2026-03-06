import combineClasses from "src/lib/combineClasses"
import styles from "./Divider.module.pcss"

interface Props {
  gapTop?: boolean
  gapBottom?: boolean
  gapLeft?: boolean
  gapRight?: boolean
  gapBottomSmall?: boolean
}

export const Divider = ({
  gapTop = false,
  gapBottom = false,
  gapLeft = false,
  gapRight = false,
  gapBottomSmall = false,
}: Props) => (
  <hr
    className={combineClasses([styles.divider], {
      [styles.top]: gapTop,
      [styles.bottom]: gapBottom,
      [styles.left]: !gapLeft,
      [styles.right]: !gapRight,
      [styles.bottomSmall]: gapBottomSmall,
    })}
  />
)
