import type { FormaElement, Transform, Urn } from "@spacemakerai/element-types"
import type { Proposal } from "src/core/elements/Proposal"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import type { NewTerrainState } from "src/core/terrain/new-terrain-state"

export type UpdateTransformCapabilityProps = {
  properties: {
    capabilities: UpdateTransformCapability
  }
}
type ElementWithTransformCapabilityProps = FormaElement & UpdateTransformCapabilityProps

export function elementHasUpdateTransformCapability(
  element: FormaElement,
): element is ElementWithTransformCapabilityProps {
  return element.properties?.capabilities?.updateTransform !== undefined
}

export type UpdateTransformCapability = {
  updateTransform: {
    script: {
      url: string
      function: "move"
    }
  }
}

export type MoveScriptRequest = {
  urn: Urn
  transform: Transform
  //TODO: Consider leaning on the SDK for these APIs
  proposal: Proposal
  terrain: NewTerrainState
}

export type MoveScriptResponse = {
  rootUrn: Urn
  elements: Map<Urn, FormaElement>
  //TODO: Can't have `BufferGeometry` in a response from a script (three.js version etc)
  //TODO: Should we load the representations using the regular pipeline instead?
  representations: RepresentationsByUrn
  transform: Transform
}
