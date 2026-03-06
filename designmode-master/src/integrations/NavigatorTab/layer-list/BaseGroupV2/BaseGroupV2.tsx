import { LayerListCategorized } from "src/integrations/NavigatorTab/layer-list/LayerListCategorized"
import type { Category } from "src/core/categories"
import styles from "src/integrations/NavigatorTab/layer-list/Layer/Category.module.pcss"
import type { FormaElement } from "@spacemakerai/element-types"
import { scenarioHiddenSignal } from "src/core/hidden"
import { useState } from "preact/hooks"
import { useCallback, useEffect } from "preact/compat"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import BaseLayerHeader from "./BaseLayerHeader/BaseLayerHeader"

type Props = {
  categories: Set<Category>
  selected: Set<Category>
  hovered: Set<Category>
  hidden: Set<Category>
  locked: Set<Category>
  pending?: Set<Category>
  base: FormaElement
  setLayerListViewState: (state: { category: Category; isBaseLayer: boolean } | null) => void
}
export const BaseGroupV2 = ({
  categories,
  selected,
  hovered,
  hidden,
  locked,
  pending,
  base,
  setLayerListViewState,
}: Props) => {
  const scenarioHidden = scenarioHiddenSignal.value
  const [collapsed, setCollapsed] = useState(Boolean(localStorage.getItem(`collapse-${base.urn}`)))
  const baseMode = scenarioModeSignal.value

  useEffect(() => {
    setCollapsed(Boolean(localStorage.getItem(`collapse-${base.urn}`)))
  }, [base])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed)
    localStorage.setItem(`collapse-${base.urn}`, "" + !collapsed)
  }, [base, collapsed])

  return (
    <>
      <div
        className={[
          styles.Scenario,
          scenarioHidden ? styles.hidden : "",
          collapsed && !baseMode ? styles.collapsed : "",
          baseMode ? styles.EditedScenario : "",
        ].join(" ")}
      >
        <BaseLayerHeader base={base} onCollapseToggle={toggleCollapsed} />
        <div className={styles.Layers}>
          <LayerListCategorized
            isScenario={true}
            hidden={hidden}
            locked={locked}
            hovered={hovered}
            selected={selected}
            pending={pending}
            categories={categories}
            setLayerListViewState={setLayerListViewState}
          />
        </div>
      </div>
    </>
  )
}
