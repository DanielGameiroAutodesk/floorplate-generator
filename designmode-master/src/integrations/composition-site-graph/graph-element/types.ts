import type { Graph, Id } from "src/integrations/composition-site-graph/graph/types"
import type { FormaElement, Child, Urn } from "@spacemakerai/element-types"
import type { Matrix4 } from "three"
import { COMPOSITION_GRAPH_GENERATOR_ID } from "./composition"

export type ChildKey = string

export type With<T, R> = { data: T } & R
export type Dimensions = { width: number; depth: number }
export type Transform = { transform: Matrix4 }

export type GraphToChildrenConnection = {
  coEdges: Record<Id, Child[]>
  edges: Record<Id, ChildKey>
}

export type PlacementSide = "left" | "right" | "center" | "doubleSided"

export type LineSettings = {
  buffer: number
  placementSide: PlacementSide
}

export const DEFAULT_BUFFER = 0
export const DEFAULT_PLACEMENT_SIDE = "left" as const
export const DEFAULT_LINE_SETTINGS = {
  buffer: DEFAULT_BUFFER,
  placementSide: DEFAULT_PLACEMENT_SIDE,
}

export type CompositionElement = FormaElement & {
  urn: Urn
  properties: {
    definingRepresentation: {
      graph: Graph
      graphToChildrenConnection: GraphToChildrenConnection
    }
    capabilities: {
      updateTransform: {
        script: {
          url: string
          function: "move"
        }
      }
    }
  }
}
export const ELEMENT_PROPERTIES_COMPOSING_ELEMENT = "composingElement"

export function isCompositionElement(element: FormaElement | undefined): element is CompositionElement {
  return element?.properties?.generator?.generatorId === COMPOSITION_GRAPH_GENERATOR_ID
}
