import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import type { LineSettings } from "./types"
import type { ParcelGraphParameters } from "src/integrations/composition-site-graph-parcel/parameters"
import { defaultParcelParameters } from "src/integrations/composition-site-graph-parcel/parameters"
import type { Graph, PType } from "src/integrations/composition-site-graph/graph/types"

type CoEdgeWithHousingProps = {
  parcelParameters: ParcelGraphParameters
}

export type HousingGraph = Graph<PType, PType & CoEdgeWithHousingProps>

export function addRowHousePropertiesToSide(
  g: Graph,
  currentTemplate: ParcelTemplate,
  lineSettings: LineSettings,
): HousingGraph {
  const rightSideCoEdgesWithRowHouses = Object.fromEntries(
    Object.entries(g._coEdges)
      .filter(([, coEdge]) => {
        if (lineSettings.placementSide === "left") return coEdge.reverse
        if (lineSettings.placementSide === "right") return !coEdge.reverse
        return false
      })
      .map(([coEdgeId, coEdge]) => [
        coEdgeId,
        {
          ...coEdge,
          properties: {
            ...coEdge.properties,
            parcelParameters: {
              ...defaultParcelParameters,
              width: currentTemplate.element.properties.generator.parameters.width,
              depth: currentTemplate.element.properties.generator.parameters.depth,
              buffer: lineSettings.buffer,
            },
          },
        },
      ]),
  )
  return {
    ...g,
    _coEdges: {
      ...g._coEdges,
      ...rightSideCoEdgesWithRowHouses,
    },
  }
}
