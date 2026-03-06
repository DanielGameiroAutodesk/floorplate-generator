import { atom, useRecoilState, useRecoilValue } from "recoil"
import { useCallback } from "preact/compat"
import type { LibraryElementInfo } from "./library"
import { libraryElementsState } from "./library"
import { resetContextRootSignal } from "src/core/selection/selectionState"
import styles from "./PlaceModeGeorefTool.module.css"
import { useExitPlaceMode } from "./resourcesHooks"
import type { Child, Urn } from "@spacemakerai/element-types"
import SubMode from "src/lib/components/SubMode/SubMode"
import { LibraryRenderables } from "./LibraryRenderables"
import type { Action } from "src/core/legacy-actions"
import type { Category } from "src/core/categories"
import { showCategory } from "src/core/categories"
import { useEffect, useMemo, useState } from "preact/hooks"
import type { InternalPath } from "src/lib/element/path"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { newChildKey } from "src/lib/element/urn"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { AnalyticsUtils, Analytics } from "src/core/analytics"
import { addNodeCursor, defaultCursor, deleteNodeCursor } from "src/integrations/cursors/setCursor"
import { SelectionToolComponent } from "src/integrations/tools-common/Selection/SelectionToolComponent"
import type { SelectionVisual } from "src/integrations/renderables/SelectionVisuals"
import { SelectionVisualInner } from "src/integrations/renderables/SelectionVisuals"
import { elementState } from "src/core/elements/ElementState"
import { representationsByUrnToKnownRepresentations } from "src/core/elements/ElementRepresentations"
import { exitCurrentTool } from "src/core/toolsState"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { getTranslator } from "src/i18n"
import {
  internalPathSetToSelectionPathSet,
  internalPathToSelectionPath,
  selectionPathSetToInternalPathSet,
  type SelectionPath,
} from "src/core/selection/selectionTypes"
import { useTranslator } from "src/i18n"

export default function SelectFromLibraryItemsToolWrapper() {
  const libraryElements = useRecoilValue(libraryElementsState)

  return libraryElements ? <PlaceModeGeorefTool toplevel={libraryElements.toplevel} /> : null
}

export const selectedLibraryElementsState = atom<Set<InternalPath>>({
  key: "selected-library-elements",
  default: new Set<InternalPath>(),
})

export const hoveredLibraryElementsState = atom<Set<InternalPath>>({
  key: "hovered-library-elements",
  default: new Set<InternalPath>(),
})

const useAddSelectedLibraryItems = () => {
  const libraryElement = useRecoilValue(libraryElementsState)
  const actionAPI = useActionAPI()

  const resetTool = exitCurrentTool

  return useCallback(
    (selectedIds: Set<InternalPath>, contextRoot: InternalPath) => {
      if (!libraryElement) return

      let actions: Action<"add">[] = []

      function addAction(urn: Urn, parentPath: InternalPath, child: Omit<Child, "urn">) {
        if (!libraryElement) return
        const element = libraryElement.state.elements.getOrThrow(urn)
        actions.push({
          type: "add",
          element,
          parentPath,
          child,
          representations: representationsByUrnToKnownRepresentations(libraryElement.state.representations, urn),
          persisted: true,
        })

        const path = mergePath(parentPath, child.key)
        for (const child of element.children ?? []) {
          const { urn, ..._child } = child
          addAction(urn, path, _child)
        }
      }

      for (let id of selectedIds) {
        const info = libraryElement.toplevel.find((e) => e.path === id)
        if (!info) continue
        addAction(info.urn, contextRoot, { key: newChildKey(), transform: info.worldTransform?.toArray() })
      }

      const categories: Category[] = libraryElement.toplevel.map((tl) => tl.category)
      const inScenario = contextRoot === ROOT_KEY ? "no" : "yes"

      categories.forEach((c) => showCategory(c, contextRoot !== ROOT_KEY))
      actionAPI.apply("Place mode (add)", actions, {
        tool: "placemode-georef",
        numElements: selectedIds.size,
        eventType: "add",
        elementCategory: AnalyticsUtils.trackedElementCategory(categories),
        inScenario,
      })
      Analytics.track(
        EventName.Add,
        {
          feature_category: FeatureCategory.ContextualData,
          feature: "place_mode",
          sub_feature: "place_mode_georef",
          object_type: "element",
        },
        { category: AnalyticsUtils.trackedElementCategory(categories) },
      )

      const t = getTranslator()
      window.forma_toasts.push({
        status: "success",
        content: t(($) => $.placeMode.geometriesAdded, {
          count: selectedIds.size,
          layerType: inScenario ? "base layer" : "proposal",
        }),
        autoDismiss: true,
      })

      resetTool()
      resetContextRootSignal()
    },
    [actionAPI, libraryElement, resetTool],
  )
}

function PlaceModeGeorefTool({ toplevel }: { toplevel: LibraryElementInfo[] }) {
  const t = useTranslator()
  const [selectedIds, setSelectedIds] = useRecoilState(selectedLibraryElementsState)
  const [hoveredIds, setHoveredIds] = useRecoilState(hoveredLibraryElementsState)

  const snapshot = elementState.currentSnapshot.value

  // Auto-select everything except what is already placed when entering
  useEffect(() => {
    const existingUrns = new Set(snapshot.elements.keys())
    const existingGeometries = new Set(
      Array.from(snapshot.elements.values())
        .map((container) => container.element.properties?.geometry_hash)
        .filter((geometryHash) => geometryHash !== undefined),
    )

    setSelectedIds(
      new Set(
        toplevel
          .filter((tl) =>
            tl.element.properties?.geometry_hash
              ? !existingGeometries.has(tl.element.properties?.geometry_hash)
              : !existingUrns.has(tl.urn),
          )
          .map((tl) => tl.path),
      ),
    )
  }, [setSelectedIds, snapshot, toplevel])

  const addSelectedLibraryItems = useAddSelectedLibraryItems()
  const basePath = elementState.currentBasePathSignal.value.value

  const exit = useExitPlaceMode()

  const [shiftDown, setShiftDown] = useState(false)

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedIds.size > 0) {
        addSelectedLibraryItems(selectedIds, basePath)
        exit()
      }
      if (e.key === "a" && e.metaKey) {
        setSelectedIds(new Set(toplevel.map((info) => info.path)))
      }
      if (e.key === "Shift") {
        setShiftDown(true)
      }
    },
    [addSelectedLibraryItems, basePath, toplevel, exit, selectedIds, setSelectedIds],
  )

  const keyup = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") {
      setShiftDown(false)
    }
  }, [])

  const select = useCallback(
    (selection: Set<InternalPath>) => {
      if (shiftDown && selection.size === 0) {
        return
      } else {
        setSelectedIds(selection)
      }
    },
    [setSelectedIds, shiftDown],
  )

  useEffect(() => {
    if (!shiftDown) {
      defaultCursor()
    } else if (Array.from(hoveredIds).some((hovered) => selectedIds.has(hovered))) {
      deleteNodeCursor()
    } else {
      addNodeCursor()
    }
  }, [hoveredIds, shiftDown, selectedIds])

  useEffect(() => {
    window.addEventListener("keydown", keydown)
    window.addEventListener("keyup", keyup)
    return () => {
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("keyup", keyup)
    }
  }, [keydown, keyup])

  const raycastTargets = useMemo(() => {
    return new Map(
      toplevel.flatMap((info) => info.geometry.raycastTargets).map((target) => [target.object, target.data]),
    )
  }, [toplevel])

  const selectionVisuals: SelectionVisual[] = useMemo(() => {
    return toplevel.flatMap((el) =>
      el.geometry.selectionOutlines.map(
        (so): SelectionVisual => ({
          selectionPath: internalPathToSelectionPath(so.fullpath),
          outlineArray: so.position,
          scenario: false,
        }),
      ),
    )
  }, [toplevel])

  const selectedPaths: Set<SelectionPath> = useMemo(() => internalPathSetToSelectionPathSet(selectedIds), [selectedIds])
  const hoveredPaths: Set<SelectionPath> = useMemo(() => internalPathSetToSelectionPathSet(hoveredIds), [hoveredIds])

  return (
    <>
      <SubMode mode={"add"}>
        <div className={styles.BorderHeader}>
          <div className={styles.Count}>
            <span>{selectedIds.size}</span>
          </div>
          <span>{t(($) => $.placeMode.geometriesSelectedLabel)}</span>
          <span className={styles.Padding}></span>
          <weave-button
            className={styles.CancelButton}
            onClick={() => {
              exit()
            }}
            variant={"flat"}
          >
            {t(($) => $.ui.cancel)}
          </weave-button>
          <weave-button
            className={styles.WhiteButton}
            disabled={selectedIds.size === 0}
            onClick={() => {
              if (selectedIds.size === 0) return
              addSelectedLibraryItems(selectedIds, basePath)
              exit()
            }}
            variant={"white"}
          >
            {t(($) => $.ui.add)}
          </weave-button>
        </div>
      </SubMode>
      <SelectionToolComponent
        raycastTargets={raycastTargets}
        currentSelectionPaths={selectedPaths}
        selectPaths={(selectionPaths) => select(selectionPathSetToInternalPathSet(selectionPaths))}
        setCurrentHoverPaths={(selectionPaths) => setHoveredIds(selectionPathSetToInternalPathSet(selectionPaths))}
        hoveredPaths={hoveredPaths}
        doubleClickCallback={() => {}}
      />
      <SelectionVisualInner
        selectionVisuals={selectionVisuals}
        selectedPaths={selectedPaths}
        selectionVisible={true}
        hoveredPaths={hoveredPaths}
        highlightVisible={true}
        hiddenPaths={new Set()}
      />
      <LibraryRenderables />
    </>
  )
}
