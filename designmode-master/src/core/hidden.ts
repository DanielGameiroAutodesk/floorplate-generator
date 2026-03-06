import { createStorageSignal } from "src/lib/storageEffect"
import type { InternalPath } from "src/lib/element/path"
import { computed } from "@preact/signals"
import { explicitSignalWithReset } from "src/lib/signal"
import { elementState } from "./elements/ElementState"
import { isDefined } from "src/lib/array"
import { Set_add, Set_delete } from "src/lib/set"
import { selectedDirectChildrenOfContextRootSignal } from "./selection/selectionState"
import type { CustomSelectionPath } from "./selection/selectionTypes"

// Note that as of 2024-09-30 a lot of usages if this seems to be very
// inconsistent, e.g. some usages change only a few paths,
// while others take full control over it.
// Also note that what is hidden is not a stack, and can be reset
// while another component tries to keep it hidden.
// It might be a good idea to rework this API for better consistency.

const [hiddenPathsSignal, setHiddenPathsSignalValue, resetHiddenPaths] = explicitSignalWithReset<
  Set<InternalPath | CustomSelectionPath>
>(new Set())

/**
 * TODO: Describe what this is and intended usage.
 */
export const HiddenPaths = {
  hiddenPathsSignal,
  setHiddenPathsSignalValue,
  resetHiddenPaths,
  hiddenPathsAsArraySignal: computed(() => Array.from(hiddenPathsSignal.value)),

  /**
   * Hides/shows the rendereable for an element
   * Usually used to temporarily hide an element while editing it, replacing it with a temp preview visual
   * @param path path of the element
   * @param hidden setting this to true will hide the visuals for this element
   */
  setPathHidden: (path: InternalPath | CustomSelectionPath, hidden: boolean) => {
    setHiddenPathsSignalValue((currentlyHidden) => {
      return hidden ? Set_add(currentlyHidden, path) : Set_delete(currentlyHidden, path)
    })
  },

  setPathsHidden: (paths: Set<InternalPath | CustomSelectionPath>, hide: boolean) => {
    setHiddenPathsSignalValue((prev) => {
      const next = new Set(prev)
      if (hide) {
        paths.forEach((path) => next.add(path))
      } else {
        paths.forEach((path) => next.delete(path))
      }
      return next
    })
  },

  setSelectedContextRootDirectChildrenHidden(hide: boolean) {
    if (hide) {
      const directChildren = selectedDirectChildrenOfContextRootSignal.peek()
      setHiddenPathsSignalValue(directChildren)
    } else {
      // TODO: This implementation looks wrong. It shouldn't reset anything set by another tool on exit?
      resetHiddenPaths()
    }
  },

  allHiddenPathsExpandedSignal: computed<Set<InternalPath | CustomSelectionPath>>(() => {
    const proposal = elementState.currentProposalSignal.value
    const tempHiddenNodes = Array.from(HiddenPaths.hiddenPathsAsArraySignal.value)
      .map((path) => proposal.snapshot.getNode(path))
      .filter(isDefined)
    const toplevelHiddenNodes = proposal.getToplevelNodes().filter((node) => node.getIsHiddenReactive())
    const hiddenNodes = [...toplevelHiddenNodes, ...tempHiddenNodes]

    const result = new Set<InternalPath | CustomSelectionPath>()
    for (const node of proposal.snapshot.getNodesWithAllDescendants(hiddenNodes)) {
      result.add(node.path)
    }
    return result
  }),
}

export const scenarioHiddenSignal = createStorageSignal<boolean>(sessionStorage, "scenarioHiddenState", false)
