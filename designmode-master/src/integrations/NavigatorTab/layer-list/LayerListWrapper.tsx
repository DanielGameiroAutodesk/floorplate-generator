import styles from "./Layer/Category.module.pcss"
import { type Category } from "src/core/categories"
import { hoveredIdsSignal, resetSelectionSetSignal, selectionSetSignal } from "src/core/selection/selectionState"
import { ObjectList, ObjectListSkeleton } from "./ObjectList"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { useEffect, useState } from "preact/hooks"
import { allCategories } from "./LayerListCategorized"
import { useTranslator } from "src/i18n"

export type CategoryState = {
  proposal: Set<Category>
  scenario: Set<Category>
}

function useAutoSubLayerNavigationBySelection(
  selectedCategories: CategoryState,
  setLayerListViewState: (state: { category: Category; isBaseLayer: boolean } | null) => void,
) {
  useEffect(() => {
    if (
      selectedCategories.proposal.size === 1 &&
      selectedCategories.scenario.size === 0 &&
      selectedCategories.proposal.has("reference_image")
    ) {
      const selectedGategory = selectedCategories.proposal.values().next().value
      setLayerListViewState({ category: selectedGategory!, isBaseLayer: false })
    } else if (
      selectedCategories.scenario.size === 1 &&
      selectedCategories.proposal.size === 0 &&
      selectedCategories.scenario.has("reference_image")
    ) {
      const selectedGategory = selectedCategories.scenario.values().next().value
      setLayerListViewState({ category: selectedGategory!, isBaseLayer: true })
    } else {
      setLayerListViewState(null)
    }
  }, [selectedCategories, setLayerListViewState])
}

export default function LayerListWrapper() {
  const t = useTranslator()
  const categories = useComputed(() => {
    const toplevel = elementState.currentProposalSignal.value.getToplevelNodes()
    const res = {
      proposal: new Set<Category>(),
      scenario: new Set<Category>(),
    }
    for (const el of toplevel) {
      const category = el.elementContainer.mappedCategory
      if (category === "terrain") continue

      const set = el.isInBase ? res.scenario : res.proposal
      set.add(category)
    }
    return res
  }).value

  const selectedCategories = useComputed(() => {
    const toplevel = elementState.currentProposalSignal.peek().getToplevelNodes()
    const selection = selectionSetSignal.value
    const res = {
      proposal: new Set<Category>(),
      scenario: new Set<Category>(),
    }
    for (const el of toplevel) {
      const category = el.elementContainer.mappedCategory
      if (category === "terrain") continue

      const set = el.isInBase ? res.scenario : res.proposal
      if (selection.has(el.path)) set.add(category)
    }
    return res
  }).value

  const hoveredCategories = useComputed(() => {
    const toplevel = elementState.currentProposalSignal.peek().getToplevelNodes()
    const hoveredIds = hoveredIdsSignal.value
    const res = {
      proposal: new Set<Category>(),
      scenario: new Set<Category>(),
    }
    for (const el of toplevel) {
      const category = el.elementContainer.mappedCategory
      if (category === "terrain") continue

      const set = el.isInBase ? res.scenario : res.proposal
      if (hoveredIds.has(el.path)) set.add(category)
    }
    return res
  }).value

  const [layerListViewState, setLayerListViewState] = useState<{
    category: Category
    isBaseLayer: boolean
  } | null>(null)

  useAutoSubLayerNavigationBySelection(selectedCategories, setLayerListViewState)

  return (
    <>
      <div className={styles.Wrapper}>
        <div className={styles.ObjectListHeader}>
          {layerListViewState ? (
            <div
              role="button"
              onClick={() => {
                setLayerListViewState(null)
                resetSelectionSetSignal()
              }}
              className={styles.SelectedCategoryTitle}
            >
              <forma-icon-arrow-left />
              <h4>
                <strong>{t.getText(allCategories[layerListViewState.category].title)}</strong>
              </h4>
            </div>
          ) : (
            <h4>
              <strong>{t(($) => $.layersTitle)}</strong>
            </h4>
          )}
        </div>
        <ObjectList
          categories={categories}
          selectedCategories={selectedCategories}
          hoveredCategories={hoveredCategories}
          layerListViewState={layerListViewState}
          setLayerListViewState={setLayerListViewState}
        />
      </div>
    </>
  )
}

export function LayerListWrapperSkeleton() {
  const t = useTranslator()
  return (
    <>
      <div className={styles.Wrapper}>
        <div className={styles.ObjectListHeader}>
          <h4>
            <strong>{t(($) => $.layersTitle)}</strong>
          </h4>
        </div>
        <ObjectListSkeleton />
      </div>
    </>
  )
}
