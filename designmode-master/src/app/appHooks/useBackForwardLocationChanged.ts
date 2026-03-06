import { useEffect } from "preact/hooks"
import { CurrentLocation } from "src/lib/location"
import { setProposalIdSignalValue, setRevisionSignalValue } from "src/core/proposal"
import { batch } from "@preact/signals"

export default function useBackForwardLocationChanged() {
  /* Listen to browser back/forward being popped and set proposalId to match the URL */
  useEffect(() => {
    const onPopState = () => {
      batch(() => {
        setProposalIdSignalValue(CurrentLocation.getProposalId())
        setRevisionSignalValue(CurrentLocation.getRevision())
      })
    }
    window.addEventListener("popstate", onPopState)

    return () => window.removeEventListener("popstate", onPopState)
  }, [])
}
