import { useSignalEffect } from "@preact/signals"
import { addBreadcrumb } from "@sentry/browser"
import { proposalIsLoadingSignal } from "src/core/initialization/proposal"
import { cancelLongSaveTimeDetector } from "./long-save-time-detector"
import { isSavingSignal, notPersistedContainersSignal, savingErrorsSignal } from "./state.internal"
import { elementState } from "src/core/elements/ElementState"
import { triggerSave } from "./trigger-save"

const SAVE_DEBOUNCE_DELAY = 0 // ms
export const useAutoSave = () => {
  useSignalEffect(() => {
    if (!elementState.isInitializedSignal.value) return
    if (proposalIsLoadingSignal.value) return

    const notPersisted = notPersistedContainersSignal.value
    if (notPersisted.length === 0) {
      cancelLongSaveTimeDetector() //All actions start a save timer, but some actions don't actually end up requiring saves, as everything is still persisted.
    }

    const saving = isSavingSignal.value
    const savingErrors = savingErrorsSignal.value
    if (notPersisted.length === 0 || saving || savingErrors.length > 0) return
    addBreadcrumb({ type: "info", level: "info", category: "saving", message: "Saving queued" })
    const handler = setTimeout(() => {
      void triggerSave()
    }, SAVE_DEBOUNCE_DELAY)
    return () => {
      addBreadcrumb({ type: "info", level: "info", category: "saving", message: "Saving queue cancelled" })
      clearTimeout(handler)
    }
  })
}
