import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { elementState } from "src/core/elements/ElementState"
import { useSignal, useSignalEffect } from "@preact/signals"
import type { Proposal } from "src/core/elements/Proposal"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-attribution": JSX.HTMLAttributes<HTMLElement> & { rooturn?: string; mapbox?: "" | undefined }
    }
  }
}

export default function Attribution() {
  useLazyLoadScript("/web-components/attribution-component/attribution-component.js", "atlas")

  const lastPersistedProposalSignal = useSignal<Proposal>()
  useSignalEffect(() => {
    const proposal = elementState.currentProposalSignal.value
    if (proposal.container.isServerState) {
      lastPersistedProposalSignal.value = proposal
    }
  })

  if (!lastPersistedProposalSignal.value) return null

  return (
    <forma-attribution
      style="position: absolute; bottom: 0; right: 16px;"
      rooturn={lastPersistedProposalSignal.value.urn}
      mapbox={lastPersistedProposalSignal.value.terrain?.textureAttributionTag === "MAPBOX" ? "" : undefined}
    ></forma-attribution>
  )
}
