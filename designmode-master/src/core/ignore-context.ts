import { contextRootSignal, fadeAllExceptSignal, fadeAllSignal, fadedElementsSignal } from "./selection/selectionState"
import type { InternalPath } from "src/lib/element/path"
import { ROOT_KEY } from "src/lib/element/path"
import { computed } from "@preact/signals"
import { explicitSignalWithReset } from "src/lib/signal"
import { elementState } from "./elements/ElementState"

const [ignoreContextSignal, setIgnoreContext, resetIgnoreContextSignal] = explicitSignalWithReset<boolean>(false)

/**
 * Used to temporarily ignore context when tracing elements to be able
 * to trace scenario elements when in "proposal" editing and vice versa.
 */
export const IgnoreContext = {
  ignoreContextSignal,
  setIgnoreContext,
  reset: resetIgnoreContextSignal,

  /**
   * All the ids which are currently not in the editing/selection context.
   * This is used to decide which elements are rendered faintly and which are rendered normal.
   * 1. If an element is currently edited, only elements in that subtree is in the "context"
   * 2. If a group is expanded, only elements in that group is in the context
   */
  idsNotInContextSignal: computed<Set<InternalPath>>(() => {
    const contextRoot = contextRootSignal.value
    const fadeAll = fadeAllSignal.value
    const fadeAllExcept = fadeAllExceptSignal.value
    const fadedElements = fadedElementsSignal.value
    const ignoreContext = ignoreContextSignal.value

    const allPaths = Array.from(elementState.currentSnapshot.value.nodes.keys())

    let contexts: InternalPath[] = []
    if (fadeAllExcept.length > 0) {
      contexts = fadeAllExcept
    } else if (contextRoot) {
      contexts = [contextRoot]
    } else {
      contexts = [ROOT_KEY]
    }

    if (fadeAll) return new Set(allPaths)

    if (ignoreContext) {
      return new Set<string>()
    }

    const notInContext = new Set(allPaths.filter((path) => !contexts.some((context) => path.startsWith(context))))
    fadedElements.forEach((path) => notInContext.add(path))
    return notInContext
  }),
}
