import { updateAllPreviouslySyncedPaths } from "src/integrations/element-state-side-effects-adapter/syncPath"
import { elementState } from "src/core/elements/ElementState"
import { HiddenPaths } from "src/core/hidden"
import { useSignalEffect } from "@preact/signals"
import { edited3DSPathSignal } from "./EditWSMElementTool"
import { formitInitializedSignal } from "./useInitialize"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"

// Updates the WSM synced objects when the visibility of any element
// changes, such as in the catergories (i.e.layers) menu
export function useUpdateWSMFromAllPreviouslySyncedPaths() {
  useSignalEffect(() => {
    if (formitInitializedSignal.value) {
      const proposal = elementState.currentProposalSignal.value

      // Including this dummy statement to make sure the effect reruns when the signal changes
      // The use of HiddenPaths.allHiddenPathsExpandedSignal.peek().has(path) in the call below
      // does not trigger the effect when the signal changes
      HiddenPaths.allHiddenPathsExpandedSignal.value

      // This is the path that needs to be ignored when updating the synced paths. If in
      // 3DS mode it is the path to the edited element (which becomes hidden),
      // otherwise it is undefined
      const ignoredPath = edited3DSPathSignal.value

      // Make sure all previoulsy synced paths are deleted if the visibility
      // of any element changed
      updateAllPreviouslySyncedPaths(
        wsmSideEffectAdapter,
        proposal,
        (path) => HiddenPaths.allHiddenPathsExpandedSignal.peek().has(path),
        ignoredPath,
      )
    }
  })
}
