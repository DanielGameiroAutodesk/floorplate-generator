import type { ChildNodeContainer } from "./ChildNodeContainer"
import type { ElementSnapshot } from "./ElementSnapshot"
import type { PathState } from "src/core/paths"
import { pathStateSignal } from "src/core/paths"
import type { CategoryState } from "src/core/categories"
import { categoryStateSignal } from "src/core/categories"
import type { InternalPath } from "src/lib/element/path"
import { previewSetSignal } from "src/core/preview-element-state"
import { HiddenPaths, scenarioHiddenSignal } from "src/core/hidden"
import { IgnoreContext } from "src/core/ignore-context"
import { contextRootSignal } from "src/core/selection/selectionState"
import { computed } from "@preact/signals"
import type { Proposal } from "./Proposal"
import type { Terrain } from "./Terrain"

export type ChildNodePredicate = (node: ChildNodeContainer) => boolean

const getCategoryStateForContext = (categoryState: CategoryState, isInBase: boolean) =>
  categoryState[isInBase ? "scenario" : "proposal"]

export const NODE_PREDICATES = {
  // Composition.
  allOf: (...predicates: ChildNodePredicate[]): ChildNodePredicate => {
    return (node: ChildNodeContainer) => predicates.every((predicate) => predicate(node))
  },
  noneOf: (...predicates: ChildNodePredicate[]): ChildNodePredicate => {
    return (node: ChildNodeContainer) => !predicates.some((predicate) => predicate(node))
  },
  not: (predicate: ChildNodePredicate): ChildNodePredicate => {
    return (node: ChildNodeContainer) => !predicate(node)
  },

  // State-specific.
  isInVisibleCategory: (categoryState: CategoryState) => (node: ChildNodeContainer) => {
    const categoryStateForContext = getCategoryStateForContext(categoryState, node.isInBase)
    const category = node.elementContainer.mappedCategory
    return !categoryStateForContext.hidden.has(category)
  },
  isNotHiddenPath: (pathState: PathState) => (node: ChildNodeContainer) => {
    return !pathState.proposal.hidden.has(node.path) && !pathState.scenario.hidden.has(node.path)
  },
  isNotLockedCategory: (categoryState: CategoryState, ignoreContext: boolean) => (node: ChildNodeContainer) => {
    const categoryStateForContext = getCategoryStateForContext(categoryState, node.isInBase)
    const category = node.elementContainer.mappedCategory
    return !categoryStateForContext.locked.has(category) || ignoreContext
  },
  isNotLockedPath: (pathState: PathState) => (node: ChildNodeContainer) => {
    return !pathState.proposal.locked.has(node.path) && !pathState.scenario.locked.has(node.path)
  },
  isScenarioVisibleForScenarioNode: (scenarioHidden: boolean) => (node: ChildNodeContainer) => {
    return !(scenarioHidden && node.isInBase)
  },
  isNotTempHidden: (tempHidden: Set<InternalPath>) => (node: ChildNodeContainer) => {
    return !tempHidden.has(node.path)
  },
  isNotHiddenByPreview: (previewSet: Set<InternalPath>) => (node: ChildNodeContainer) => {
    return !previewSet.has(node.path)
  },
  isNotTerrain: (terrain: Terrain) => (node: ChildNodeContainer) => {
    return node !== terrain.node
  },
  isUnderCurrentContextRoot: (contextRoot: InternalPath) => (node: ChildNodeContainer) => {
    return node.path.startsWith(contextRoot)
  },
  isNotVirtual: () => (node: ChildNodeContainer) => {
    return !node.elementContainer.element.properties?.virtual
  },
} satisfies Record<string, (...args: any) => ChildNodePredicate>

export const getVisibleNodesSignal = computed(() => {
  const previewFilter = previewSetSignal.value
  const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
  const categoryState = categoryStateSignal.value
  const pathState = pathStateSignal.value
  const scenarioHidden = scenarioHiddenSignal.value

  return (proposal: Proposal, options?: { ignoreVirtualNodes?: boolean }): ChildNodeContainer[] => {
    // Filters that only apply to direct children of proposal/base
    const toplevelPredicate: ChildNodePredicate[] = [
      NODE_PREDICATES.isInVisibleCategory(categoryState),
      NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHidden),
      NODE_PREDICATES.isNotHiddenPath(pathState),
      ...(options?.ignoreVirtualNodes ? [NODE_PREDICATES.isNotVirtual()] : []),
    ]

    // Filters that apply to any node
    const anyNodePredicate: ChildNodePredicate[] = [
      NODE_PREDICATES.isNotTempHidden(hiddenPaths),
      NODE_PREDICATES.isNotHiddenByPreview(previewFilter),
    ]
    return proposal
      .getToplevelNodes()
      .filter(NODE_PREDICATES.allOf(...toplevelPredicate, ...anyNodePredicate))
      .flatMap((node) => proposal.snapshot.traverseNodes(node, NODE_PREDICATES.allOf(...anyNodePredicate)))
  }
})

export const getRaycastableToplevelNodesSignal = computed(() => {
  const previewFilter = previewSetSignal.value
  const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
  const categoryState = categoryStateSignal.value
  const pathState = pathStateSignal.value
  const scenarioHidden = scenarioHiddenSignal.value
  const ignoreContext = IgnoreContext.ignoreContextSignal.value
  const contextRoot = contextRootSignal.value

  return (proposal: Proposal): ChildNodeContainer[] => {
    const predicates: ChildNodePredicate[] = [
      NODE_PREDICATES.isUnderCurrentContextRoot(contextRoot),
      NODE_PREDICATES.isInVisibleCategory(categoryState),
      NODE_PREDICATES.isNotLockedCategory(categoryState, ignoreContext),
      NODE_PREDICATES.isNotHiddenPath(pathState),
      NODE_PREDICATES.isNotLockedPath(pathState),
      NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHidden),
      NODE_PREDICATES.isNotTempHidden(hiddenPaths),
      NODE_PREDICATES.isNotHiddenByPreview(previewFilter),
    ]
    return proposal.getToplevelNodes().filter(NODE_PREDICATES.allOf(...predicates))
  }
})

export function getNonHiddenNodes(
  snapshot: ElementSnapshot,
  scenarioHidden: boolean,
  categoryState: CategoryState,
): ChildNodeContainer[] {
  return [...snapshot.nodes.values()].filter(
    NODE_PREDICATES.allOf(
      NODE_PREDICATES.isInVisibleCategory(categoryState),
      NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHidden),
    ),
  )
}
