import {
  selectedTopLevelNodesSignal,
  selectionSetSignal,
  setSelectionSetSignalValue,
} from "src/core/selection/selectionState"
import { Set_filter, Set_shallowEquals } from "src/lib/set"
import { useSignalEffect } from "@preact/signals"
import ArrayUtils from "src/lib/array"
import { isAppInitializedSignal } from "src/core/app-initialized"

//TODO: would this be better achieved by filtering when setting the value of selectionSetState? Could be done by converting selectionSetState to a selector and implementing filtering in set()
export function useDeselectUnselectableElements() {
  useSignalEffect(() => {
    if (!isAppInitializedSignal.value) return

    const selectedNodesByPath = ArrayUtils.associateBy(selectedTopLevelNodesSignal.value, (it) => it.path)

    const newSelection = Set_filter(selectionSetSignal.value, (path) => {
      const el = selectedNodesByPath.get(path)
      return !el || !(el.getIsHiddenReactive() || el.getIsLockedReactive())
    })
    if (!Set_shallowEquals(newSelection, selectionSetSignal.value)) {
      setSelectionSetSignalValue(newSelection)
    }
  })
}
