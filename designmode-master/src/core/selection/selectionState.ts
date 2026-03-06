import { IgnoreContext } from "src/core/ignore-context"
import { Set_filter, Set_shallowEquals } from "src/lib/set"

import { ElementKeyPath, type InternalPath, ROOT_KEY } from "src/lib/element/path"
import { viewRevisionSignal } from "src/core/proposal"
import { useCallback, useEffect } from "preact/hooks"
import { computed } from "@preact/signals"
import { createMappedSetterOrUpdater, explicitSignal, explicitSignalWithReset } from "src/lib/signal"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import type { FormaElement } from "forma-elements"
import { DesignModeEvents } from "src/core/events/events"
import { pendingOperationSignal, setPendingOperationPreventedActionSignalValue } from "src/core/pending-operation"
import {
  elementSelectionPathToInternalPath,
  internalPathSetToSelectionPathSet,
  internalPathToSelectionPath,
  isCustomSelectionPath,
  isElementSelectionPath,
  type SelectionPath,
  selectionPathSetToInternalPathSet,
} from "./selectionTypes"

/**
 * This is the main source of truth for which "entities" are currently selected in the scene.
 * "Entities" here means both elements and potentially other custom, selectable non-element items in
 * the scene. The latter would come from Selectable objects with target: { type: "custom", ... },
 * see src/core/elements/element-container-derived-data/selectables.ts for more info.
 *
 * Consumers of this signal thus need to distinguish between SelectionPaths that identify elements
 * or custom selectables. If your code only wants to deal with elements, see selectionSetSignal
 * below or its derivatives such as selectedNodesSignal. These are derived/computed signals from
 * this signal, with all custom entities filtered out.
 */
export const [selectionPathsSignal, setSelectionPathsSignalValue, resetSelectionPathsSignal] = explicitSignalWithReset<
  Set<SelectionPath>
>(new Set())

/**
 * Current selected paths, including potential orphan paths. Derived from selectionPathsSignal above
 * by filtering out all non-element SelectionPaths.
 *
 * You most likely never want to read this, but instead use the computed
 * variants that join it with the current proposal.
 *
 * Recommended alternative: selectedNodesSignal
 */
export const selectionSetSignal = computed(() => selectionPathSetToInternalPathSet(selectionPathsSignal.value))
export const setSelectionSetSignalValue = createMappedSetterOrUpdater<Set<InternalPath>, Set<SelectionPath>>(
  selectionSetSignal,
  setSelectionPathsSignalValue,
  internalPathSetToSelectionPathSet,
)
// eslint-disable-next-line local/signals-explicit-naming
export const resetSelectionSetSignal = resetSelectionPathsSignal

export function setSelectionSignalValue(paths: InternalPath[]) {
  setSelectionSetSignalValue(new Set(paths))
}

export const selectionArraySignal = computed<InternalPath[]>(() => {
  return Array.from(selectionSetSignal.value)
})

/**
 * Get the current selection paths that exists in the current proposal.
 */
export const selectedPathsInCurrentProposalSignal = computed(() => {
  const selectedPaths = selectionSetSignal.value
  const result = new Set<InternalPath>()

  for (const path of selectedPaths) {
    const node = elementState.currentSnapshot.value.getNode(path)
    if (node) {
      result.add(path)
    }
  }

  return result
})

/**
 * Get the current selection paths that exists in the current proposal - as an array instead of Set.
 */
export const selectedPathsInCurrentProposalAsArraySignal = computed(() => {
  return Array.from(selectedPathsInCurrentProposalSignal.value)
})

let i = 0
selectionSetSignal.subscribe((newValue) => {
  // Skip initial value.
  if (i++ === 0) return

  DesignModeEvents.dispatch("selection.changed", { paths: [...newValue] })
})

export const selectedBasePathsInProposalContextSignal = computed<Set<InternalPath>>(() => {
  const selection = selectionSetSignal.value
  const basePath = elementState.currentBasePathSignal.value
  const baseMode = scenarioModeSignal.value

  if (baseMode) return new Set<string>()

  return Set_filter(selection, (id) => {
    return basePath.isAnchestorOf(id)
  })
})

export const [selectionVisibilitySignal, setSelectionVisibilitySignalValue] = explicitSignal<boolean>(true)

export const [fadeAllExceptSignal, setFadeAllExceptSignalValue, resetFadeAllExceptSignal] = explicitSignalWithReset<
  InternalPath[]
>([])

export const [fadeAllSignal, setFadeAllSignalValue, resetFadeAllSignal] = explicitSignalWithReset(false)

export const [fadedElementsSignal, setFadedElementsSignalValue, resetFadedElementsSignal] = explicitSignalWithReset<
  Set<string>
>(new Set())

export const [contextRootSignal, setContextRootSignal, resetContextRootSignal] =
  explicitSignalWithReset<InternalPath>(ROOT_KEY)

export const scenarioModeSignal = computed(() => {
  if (!elementState.isInitializedSignal.value) return false

  const contextRoot = contextRootSignal.value
  const basePath = elementState.currentBasePathSignal.value
  const isViewingCurrent = ["current", "view-only"].includes(viewRevisionSignal.value)
  return Boolean(basePath.isAnchestorOfOrEquals(contextRoot) && isViewingCurrent)
})

export function selectPaths(paths: Set<SelectionPath>): void {
  const pendingOperation = pendingOperationSignal.peek()
  if (pendingOperation) {
    setPendingOperationPreventedActionSignalValue({
      timestamp: Date.now(),
      description: (t) => t(($) => $.tools.pendingSelectionBlockedMessage),
    })
    return
  }

  const notInContext = IgnoreContext.idsNotInContextSignal.peek()
  const newSelectedElements = new Set<InternalPath>(
    Array.from(paths)
      .filter(isElementSelectionPath)
      .map(elementSelectionPathToInternalPath)
      .filter((path) => !notInContext.has(path)),
  )
  // filter out selection paths if parent is selected
  const withoutDoublySelected = Set_filter(newSelectedElements, (path) => {
    const splits = path.split("/")
    if (splits.length > 2) {
      const parentId = splits.slice(0, splits.length - 1).join("/")
      if (newSelectedElements.has(parentId)) return false
    }
    return true
  })
  const newCustomSelectionPaths = Array.from(paths).filter(isCustomSelectionPath)
  const newSelectionPaths = new Set<SelectionPath>([
    ...newCustomSelectionPaths,
    ...Array.from(withoutDoublySelected).map(internalPathToSelectionPath),
  ])
  const current = selectionPathsSignal.peek()
  setSelectionPathsSignalValue(Set_shallowEquals(newSelectionPaths, current) ? current : newSelectionPaths)
}

export const isAnythingSelectedSignal = computed<boolean>(() => {
  return !!selectionSetSignal.value.size
})

export const selectionMapSignal = computed<{ [k: string]: boolean }>(() => {
  const selectionState = Array.from(selectionSetSignal.value)
  return selectionState.reduce<{ [k: string]: boolean }>((acc, s) => {
    acc[s] = true
    return acc
  }, {})
})

export const selectedDirectChildrenOfContextRootSignal = computed<Set<InternalPath>>(() => {
  const contextKeyPath = ElementKeyPath.of(contextRootSignal.value)
  const result = new Set<InternalPath>()
  for (const path of selectionSetSignal.value) {
    if (contextKeyPath.isParentOf(path)) {
      result.add(path)
    }
  }
  return result
})

export const [highlightVisibilitySignal, setHighlightVisibilitySignalValue] = explicitSignal<boolean>(true)

/**
 * Source of truth for hovered SelectionPaths, i.e. both elements and non-element custom
 * selectables. Use hoveredIdsSignal below if you're only interested in hovered _elements_
 */
export const [hoveredSelectionPathsSignal, setHoveredSelectionPathsSignalValue, resetHoveredSelectionPathsSignal] =
  explicitSignalWithReset<Set<SelectionPath>>(new Set())

/**
 * Hovered element paths, derived from hoveredSelectionPathsSignal above
 */
export const hoveredIdsSignal = computed(() => selectionPathSetToInternalPathSet(hoveredSelectionPathsSignal.value))
export const setHoveredIdsSignalValue = createMappedSetterOrUpdater<Set<InternalPath>, Set<SelectionPath>>(
  hoveredIdsSignal,
  setHoveredSelectionPathsSignalValue,
  internalPathSetToSelectionPathSet,
)
// eslint-disable-next-line local/signals-explicit-naming
export const resetHoveredIdsSignal = resetHoveredSelectionPathsSignal

export const hoveredIdsArraySignal = computed<string[]>(() => {
  return Array.from(hoveredIdsSignal.value)
})

export const setHoveredIdsArraySignalValue = createMappedSetterOrUpdater(
  hoveredIdsArraySignal,
  setHoveredIdsSignalValue,
  (value) => new Set(value),
)

export const [highlightedFillSignal, setHighlightedFillSignalValue, resetHighlightedFillSignal] =
  explicitSignalWithReset<Set<InternalPath>>(new Set())

export function setHighlightedFillArraySignalValue(paths: InternalPath[]) {
  setHighlightedFillSignalValue(new Set(paths))
}

export const highlightedFillArraySignal = computed<InternalPath[]>(() => {
  return Array.from(highlightedFillSignal.value)
})

export const useSetHoveredSelectionPaths = () =>
  useCallback((selectionPaths: Set<SelectionPath>) => {
    const notInContext = IgnoreContext.idsNotInContextSignal.peek()
    const toBeSetIds = Set_filter(
      selectionPaths,
      (selectionPath) =>
        !(isElementSelectionPath(selectionPath) && notInContext.has(elementSelectionPathToInternalPath(selectionPath))),
    )
    const current = hoveredSelectionPathsSignal.peek()
    setHoveredSelectionPathsSignalValue(Set_shallowEquals(toBeSetIds, current) ? current : toBeSetIds)
  }, [])

export const selectedNodesSignal = computed<ChildNodeContainer[]>(() => {
  const selectedPaths = selectionSetSignal.value
  const result: ChildNodeContainer[] = []

  for (const path of selectedPaths) {
    const node = elementState.currentSnapshot.value.getNode(path)
    if (node) {
      result.push(node)
    }
  }

  return result
})

export const selectedTopLevelNodesSignal = computed<ChildNodeContainer[]>(() => {
  const selectedPaths = selectionSetSignal.value
  return elementState.currentProposalSignal.value.getToplevelNodes().filter((node) => selectedPaths.has(node.path))
})

export const selectedTopLevelElementsSignal = computed<FormaElement[]>(() => {
  return selectedTopLevelNodesSignal.value.map((node) => node.elementContainer.element)
})

export const selectedTopLevelPathsSignal = computed<Set<InternalPath>>(() => {
  return new Set(selectedTopLevelNodesSignal.value.map((node) => node.path))
})

/**
 * Path of selected top level elements and path for all their descendant elements.
 */
export const selectedTopLevelPathsWithDescendantsSignal = computed<Set<InternalPath>>(() => {
  const snapshot = elementState.currentSnapshot.value
  const result = new Set<InternalPath>()
  for (const node of snapshot.getNodesWithAllDescendants(selectedTopLevelNodesSignal.value)) {
    result.add(node.path)
  }
  return result
})

export function useForceNoSelectedPaths() {
  // This intentionally uses useEffect instead of useSignalEffect to avoid
  // an issue where the effect runs when the component is expected to
  // become unmounted on next render.
  //
  // An example of this is when used in a tool, and the onComplete handler
  // adds selection and removes the tool. The actual removal of tool
  // will happen on next render, and in the meantime we don't want the
  // selection to be removed.
  const selection = selectionSetSignal.value
  useEffect(() => {
    if (selection.size > 0) {
      resetSelectionSetSignal()
    }
  }, [selection])
}
