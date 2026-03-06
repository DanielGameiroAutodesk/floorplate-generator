import type { CategoryState } from "./LayerListWrapper"
import { LayerListCategorized, LayerListSkeleton } from "./LayerListCategorized"
import { type Category, categoryPendingStateSignal, categoryStateSignal } from "src/core/categories"
import styles from "./Layer/Category.module.pcss"
import { BaseGroupV2 } from "./BaseGroupV2/BaseGroupV2"
import { elementState } from "src/core/elements/ElementState"
import { SubLayers } from "./Layer/SubLayers"

type Props = {
  categories: CategoryState
  selectedCategories: CategoryState
  hoveredCategories: CategoryState
  layerListViewState: { category: Category; isBaseLayer: boolean } | null
  setLayerListViewState: (state: { category: Category; isBaseLayer: boolean } | null) => void
}

export const ObjectList = ({
  categories,
  selectedCategories,
  hoveredCategories,
  layerListViewState,
  setLayerListViewState,
}: Props) => {
  const categoryState = categoryStateSignal.value
  const categoryPendingState = categoryPendingStateSignal.value
  const base = elementState.currentBaseSignal.value.element

  if (layerListViewState?.category) {
    return (
      <div className={styles.Container}>
        <SubLayers category={layerListViewState.category} isScenario={layerListViewState.isBaseLayer} />
      </div>
    )
  }

  return (
    <div className={styles.Container}>
      <LayerListCategorized
        isScenario={false}
        categories={categories.proposal}
        selected={selectedCategories.proposal}
        hovered={hoveredCategories.proposal}
        locked={categoryState.proposal.locked}
        hidden={categoryState.proposal.hidden}
        pending={categoryPendingState}
        setLayerListViewState={setLayerListViewState}
      />
      {base && (
        <BaseGroupV2
          base={base}
          categories={categories.scenario}
          selected={selectedCategories.scenario}
          hovered={hoveredCategories.scenario}
          hidden={categoryState.scenario.hidden}
          locked={categoryState.scenario.locked}
          pending={categoryPendingState}
          setLayerListViewState={setLayerListViewState}
        />
      )}
    </div>
  )
}

export const ObjectListSkeleton = () => {
  return (
    <div className={styles.Container}>
      <LayerListSkeleton />
    </div>
  )
}
