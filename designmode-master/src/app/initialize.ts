import { useSignalEffect } from "@preact/signals"
import { captureException } from "@sentry/browser"
import FormItWasmURL from "@spacemakerai/adsk-formit-core-standalone/dist/FormIt.ems.wasm?url"
import { setGlobalErrorSignalValue } from "src/core/global-errors"
import { isCurrentProposalRevisionLoadingOrLoadedSignal, loadProposal } from "src/core/initialization/proposal"
import { proposalIdSignal, revisionSignal } from "src/core/proposal"

export default function useInitializeProposal() {
  // This "retriggers" on browser back/forward.
  // See useBackForwardLocationChanged.ts.
  useSignalEffect(() => {
    if (!proposalIdSignal.value) return

    // Already triggered by something else?
    if (isCurrentProposalRevisionLoadingOrLoadedSignal.value) return

    window.globalLoadingOverlay.start()
    loadProposal(proposalIdSignal.value, revisionSignal.value)
      .then(async () => {
        window.globalLoadingOverlay.stop()
        // Prefetch WSM/WSR stuff after we initialized the proposal
        await import("@spacemakerai/adsk-formit-core-standalone")
        await fetch(FormItWasmURL)
      })
      .catch((e) => {
        console.error(e)
        captureException(e)
        setGlobalErrorSignalValue(e)
      })
  })
}
