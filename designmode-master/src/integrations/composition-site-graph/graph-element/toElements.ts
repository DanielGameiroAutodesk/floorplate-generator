import type { RowHouseGraph } from "src/integrations/composition-site-graph/state"
import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import type { Feature } from "geojson"
import type { GraphToChildrenConnection } from "./types"
import { createUrn, newChildKey, newId, newRevision } from "src/lib/element/urn"
import { propertyPresets } from "src/integrations/draw/DrawAPI"
import type { BasicLine } from "src/lib/geometry/geometryTypes"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { PROJECT_ID } from "src/core/project/project"

export function createRoadElements(graph: RowHouseGraph): {
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
  children: Child[]
  edgeIdMapping: GraphToChildrenConnection["edges"]
} {
  const edgeIdMapping: GraphToChildrenConnection["edges"] = {}

  const elements = new Map<Urn, FormaElement>()
  const footprints = new Map<Urn, Feature>()
  const children: Child[] = []

  for (let [edgeId, edge] of Object.entries(graph.edges)) {
    if (!edge.properties?.road) continue

    const element: FormaElement = {
      urn: createUrn("basic", PROJECT_ID, `${graph.id}+${newId()}`, newRevision()),
      properties: propertyPresets.road,
    }
    const feature: BasicLine = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [graph.vertices[edge.start].x, graph.vertices[edge.start].y],
          [graph.vertices[edge.end].x, graph.vertices[edge.end].y],
        ],
      },
      properties: {
        lineWidth: edge.properties.road.width,
      },
    }

    const child: Child = {
      key: newChildKey(),
      urn: element.urn,
    }

    elements.set(element.urn, element)
    footprints.set(element.urn, feature)
    children.push(child)
    edgeIdMapping[edgeId] = child.key
  }

  return {
    elements,
    representations: {
      footprint: footprints,
      volumeMesh: new Map(),
      terrainShape: new Map(),
      terrainTexture: new Map(),
      buildingFloors3DSketch_UNSTABLE: new Map(),
    },
    children,
    edgeIdMapping,
  }
}
