import {
  type Category,
  categoryStateSignal,
  setCategoryStateSignalValue,
  toggleCategoryFlag,
} from "src/core/categories"
import styles from "./Category.module.pcss"
import { allCategories } from "src/integrations/NavigatorTab/layer-list/LayerListCategorized"
import {
  resetSelectionSetSignal,
  selectionSetSignal,
  setHoveredIdsSignalValue,
  setSelectionPathsSignalValue,
  setSelectionSetSignalValue,
  useSetHoveredSelectionPaths,
} from "src/core/selection/selectionState"
import { showTerrainSignal } from "src/core/terrain/terrain-state"
import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { useOperationPending } from "src/integrations/PendingOperation/useOperationPending"
import { ContextMenu } from "src/integrations/ContextMenu/ContextMenu"
import TerrainContextMenu from "src/integrations/ContextMenu/TerrainContextMenu"
import { LayerItem } from "./LayerItem"
import { elementState } from "src/core/elements/ElementState"
import { findPathsForCategory } from "src/integrations/NavigatorTab/layer-list/utils"
import { pathStateSignal, setPathFlag, setPathStateSignalValue } from "src/core/paths"
import Spinner from "src/lib/components/icons/Spinner"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { LockToggle } from "./LockToggle"
import combineClasses from "src/lib/combineClasses"
import { VisibilityToggle } from "./VisibilityToggle"
import { raycastTargetsSignal } from "src/core/selection/raycast-targets"
import type { SelectionPath } from "src/core/selection/selectionTypes"
import { useTranslator } from "src/i18n"

export function CategoryLayer({
  category,
  hidden,
  locked,
  selected,
  hovered,
  pending,
  isScenario,
  setLayerListViewState,
}: {
  isScenario: boolean
  category: Category
  hidden: boolean
  locked: boolean
  selected: boolean
  hovered: boolean
  pending?: boolean
  setLayerListViewState: (state: { category: Category; isBaseLayer: boolean } | null) => void
}) {
  const t = useTranslator()
  const { isOperationPending, markOperationBlocked } = useOperationPending()
  const proposal = elementState.currentProposalSignal.value
  const toplevel = proposal.getToplevelNodes()
  const paths = useMemo(
    () => Array.from(findPathsForCategory(toplevel, isScenario, category, true, true)),
    [toplevel, category, isScenario],
  )
  const pathState = pathStateSignal.value
  const setPathState = setPathStateSignalValue

  // if reference image, the category is hidden if all images are hidden
  const isHidden =
    category === "reference_image"
      ? isScenario
        ? paths.every((path) => pathState.scenario.hidden.has(path))
        : paths.every((path) => pathState.proposal.hidden.has(path))
      : hidden

  // if reference image, the category is locked if all images are locked
  const isLocked =
    category === "reference_image"
      ? isScenario
        ? paths.every((path) => pathState.scenario.locked.has(path))
        : paths.every((path) => pathState.proposal.locked.has(path))
      : locked

  const toggleVisible = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (category === "reference_image") {
        for (const path of paths) {
          setPathState((current) => setPathFlag(current, isScenario, "hidden", path, !isHidden))
        }
      } else {
        setCategoryStateSignalValue((current) => toggleCategoryFlag(current, isScenario, "hidden", category))
      }
      Analytics.track(
        EventName.Update,
        { feature_category: FeatureCategory.UserInterface, feature: "layer_list", sub_feature: "visibility" },
        { layer: category, isBaseLayer: isScenario },
      )
    },
    [isScenario, category, paths, isHidden, setPathState],
  )

  const toggleLock = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (category === "reference_image") {
        for (const path of paths) {
          setPathState((current) => setPathFlag(current, isScenario, "locked", path, !isLocked))
        }
      } else {
        setCategoryStateSignalValue((current) => toggleCategoryFlag(current, isScenario, "locked", category))
      }
      Analytics.track(
        EventName.Update,
        { feature_category: FeatureCategory.UserInterface, feature: "layer_list", sub_feature: "lock" },
        { layer: category, isBaseLayer: isScenario },
      )
    },
    [isScenario, category, paths, isLocked, setPathState],
  )

  const onClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()

      if (isOperationPending) {
        markOperationBlocked()
        return
      }

      const toplevel = elementState.currentProposalSignal.peek().getToplevelNodes()
      const paths = findPathsForCategory(toplevel, isScenario, category, false, false)
      const current = selectionSetSignal.peek()
      if (paths.size === 0 && category === "reference_image") {
        setLayerListViewState({ category, isBaseLayer: isScenario })
      } else {
        setSelectionSetSignalValue(e.shiftKey ? new Set([...current, ...paths]) : paths)
      }
    },
    [category, isScenario, isOperationPending, markOperationBlocked, setLayerListViewState],
  )

  const onMouseOver = useCallback(() => {
    const toplevel = elementState.currentProposalSignal.peek().getToplevelNodes()
    const paths = findPathsForCategory(toplevel, isScenario, category, true, true)
    setHoveredIdsSignalValue(paths)
  }, [category, isScenario])

  const [contextMenuPos, setContextMenuPos] = useState<null | { x: number; y: number }>(null)
  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      onClick(e)
      setContextMenuPos({ x: e.clientX, y: e.clientY })
    },
    [onClick],
  )

  const id = `layer-item-${category}${isScenario ? "-scenario" : ""}`

  return (
    <>
      <LayerItem
        id={id}
        title={t.getText(allCategories[category].title)}
        category={category}
        hidden={isHidden}
        locked={isLocked}
        selected={selected}
        hovered={hovered}
        disabled={paths?.length === 0}
        pending={pending}
        isScenario={isScenario}
        onClick={onClick}
        onMouseOver={onMouseOver}
        onContextMenu={onContextMenu}
        toggleLock={toggleLock}
        toggleVisible={toggleVisible}
        numberOfElements={category === "reference_image" ? paths.length : undefined}
      />
      {pending && (
        <forma-expanded-tooltip
          target-id={id}
          text={t(($) => $.layerList.category.contextualDataDuration)}
          position={"right"}
          loadingduration={300}
        >
          <div className={styles.Tooltip}>
            <div className={styles.ProgressContainer}>
              <weave-progress size="m"></weave-progress>
            </div>
            <weave-skeleton-item radius="6px" width="200px" height="200px" />
          </div>
          <p>{t(($) => $.navigator.dataOrderProcessing)}</p>
        </forma-expanded-tooltip>
      )}
      {contextMenuPos && (
        <IfEditAccess>
          <forma-context-menu-container
            left={contextMenuPos.x}
            top={contextMenuPos.y}
            onClose={() => setContextMenuPos(null)}
          >
            <ContextMenu />
          </forma-context-menu-container>
        </IfEditAccess>
      )}
    </>
  )
}

export const LayerSkeleton = () => {
  return (
    <div className={styles.Category}>
      <div className={styles.Icon}>
        <weave-skeleton-item radius="50%" width="16px" height="16px" />
      </div>
      <div className={styles.Name}>
        <weave-skeleton-item radius="6px" width="140px" height="6px" />
      </div>
    </div>
  )
}

export function TerrainLayer({ pending }: { pending?: boolean }) {
  const t = useTranslator()
  const { title, Icon } = allCategories["terrain"]
  const setHoveredSelectionPaths = useSetHoveredSelectionPaths()
  const id = `layer-item-terrain`
  const showTerrain = showTerrainSignal.value

  const terrainPadIds = Array.from(raycastTargetsSignal.peek().values())
    .filter((element) => element.selection.split(":")[1] === "terrain_pads")
    .map((element) => element.selection)

  const onMouseEnter = useCallback(() => {
    setHoveredSelectionPaths(new Set(terrainPadIds))
  }, [setHoveredSelectionPaths, terrainPadIds])

  const onMouseLeave = useCallback(() => {
    setHoveredIdsSignalValue(new Set())
  }, [])

  useEffect(() => {
    const element = document.getElementById(id)

    if (element) {
      element.addEventListener("mouseenter", onMouseEnter)
      element.addEventListener("mouseleave", onMouseLeave)
    }

    return () => {
      if (element) {
        element.removeEventListener("mouseenter", onMouseEnter)
        element.removeEventListener("mouseleave", onMouseLeave)
      }
    }
  }, [id, onMouseEnter, onMouseLeave])

  const [contextMenuPos, setContextMenuPos] = useState<null | { x: number; y: number }>(null)

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    resetSelectionSetSignal()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <>
      <div
        id={id}
        className={[
          styles.Category,
          styles.locked,
          showTerrain ? "" : styles.hidden,
          contextMenuPos ? styles.selected : "",
        ].join(" ")}
        onContextMenu={onContextMenu}
        onClick={() => {
          setSelectionPathsSignalValue(new Set<SelectionPath>(terrainPadIds))
        }}
      >
        <div className={styles.Icon}>
          <Icon />
        </div>
        <div className={styles.Name}>{t.getText(title)}</div>
        <div className={styles.Buttons}>
          <div
            className={combineClasses([], {
              [styles.VisibilityToggle]: !categoryStateSignal.peek().proposal.locked.has("terrain"),
            })}
          >
            <LockToggle
              name={t.getText(title)}
              toggleLock={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCategoryStateSignalValue((current) => toggleCategoryFlag(current, false, "locked", "terrain"))
              }}
              locked={categoryStateSignal.peek().proposal.locked.has("terrain")}
              tooltip={false}
            />
          </div>
          <div
            className={combineClasses([], {
              [styles.VisibilityToggle]: !categoryStateSignal.peek().proposal.locked.has("terrain"),
            })}
          >
            <VisibilityToggle
              name={t.getText(title)}
              toggleVisible={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCategoryStateSignalValue((current) => toggleCategoryFlag(current, false, "hidden", "terrain"))
              }}
              hidden={categoryStateSignal.peek().proposal.hidden.has("terrain")}
              tooltip={false}
            />
          </div>

          {pending && <Spinner />}
        </div>
      </div>
      {pending && (
        <forma-expanded-tooltip
          target-id={id}
          text={t(($) => $.layerList.category.contextualDataDuration)}
          position={"right"}
          loadingduration={300}
        >
          <div className={styles.Tooltip}>
            <div className={styles.ProgressContainer}>
              <weave-progress size="m"></weave-progress>
            </div>
            <weave-skeleton-item radius="6px" width="200px" height="200px" />
          </div>
          <p>{t(($) => $.navigator.dataOrderProcessing)}</p>
        </forma-expanded-tooltip>
      )}
      {contextMenuPos && (
        <IfEditAccess>
          <forma-context-menu-container
            left={contextMenuPos.x}
            top={contextMenuPos.y}
            onClose={() => setContextMenuPos(null)}
          >
            <TerrainContextMenu />
          </forma-context-menu-container>
        </IfEditAccess>
      )}
    </>
  )
}
