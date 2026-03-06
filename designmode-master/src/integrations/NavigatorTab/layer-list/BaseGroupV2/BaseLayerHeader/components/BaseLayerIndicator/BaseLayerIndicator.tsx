import styles from "src/integrations/NavigatorTab/layer-list/Layer/Category.module.pcss"
import type { FormaElement } from "@spacemakerai/element-types"
import { DownChevron } from "./DownChevron"

type Props = {
  base: FormaElement
}
const defaultIndicator = "-"
export const BaseLayerIndicator = ({ base }: Props) => {
  return (
    <>
      <DownChevron />
      <div className={styles.BaseHeaderIcon}>{base.properties?.indicator || defaultIndicator}</div>
    </>
  )
}
