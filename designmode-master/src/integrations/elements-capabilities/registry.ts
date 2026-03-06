import type { MoveScriptRequest, MoveScriptResponse } from "./updateTransform"
import Composition from "src/integrations/composition-site-graph/graph-element/composition"
import { getElevationInLocalCoordinateSystem } from "src/integrations/composition-site-graph/tools/getGlobalTerrainPosition"
import { Matrix4 } from "three"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"

type Url = string

type CapabilityRegistry = {
  // TODO: | undefined represents the 'could not perform' state. Should this be explicit, e.g. "Bad request" / "Internal error"?
  updateTransform: Record<Url, { move: (request: MoveScriptRequest) => MoveScriptResponse | undefined }>
}

//TODO: Populate this registry by parsing elements upon initialize
export const capabilityScriptsRegistry: CapabilityRegistry = {
  updateTransform: {
    "/api/parametric/capabilities": {
      move: ({ urn, transform, proposal, terrain }: MoveScriptRequest): MoveScriptResponse | undefined => {
        const element = proposal.snapshot.getFormaElement(urn)
        if (isCompositionElement(element)) {
          const result = Composition.updateToReSetElevation(
            element,
            (x, y) =>
              getElevationInLocalCoordinateSystem({ x, y }, new Matrix4().fromArray(transform), terrain.elevationAt),
            (urn) => proposal.snapshot.getFormaElementOrThrow(urn),
          )
          return {
            rootUrn: result.rootUrn,
            elements: result.elements,
            representations: result.representations,
            transform,
          }
        }
      },
    },
  },
}
