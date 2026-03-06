import { atom } from "recoil"
import { sessionStorageEffect } from "src/lib/storageEffect"
import graph from "./graph/graph"
import type { Graph, Id } from "./graph/types"
import type { InternalPath } from "src/lib/element/path"
import type { Urn } from "@spacemakerai/element-types"
import type { ParcelGraphParameters } from "src/integrations/composition-site-graph-parcel/parameters"
import type { RowHouseParameters } from "src/integrations/composition-row-house-generator/api"

export type EdgeSide = "LEFT" | "RIGHT" | "BOTH"

export type RoadParameters = {
  type: "road" | "path"
  width: number
  path: InternalPath
}

export type EdgeProperties = {
  road?: RoadParameters
  parcels?: {
    side: EdgeSide
  }
  element?: {
    urn: Urn
    path: InternalPath
  }
}

export type CoEdgeProperties = {
  parcels?: boolean
  parcelParameters?: ParcelGraphParameters
  //TODO: Remove
  rowHouseParameters?: RowHouseParameters
  vegetationParameters?: boolean

  [key: string]: any
}

export type VegParams = {
  height: number
}

export type RowHouseGraph = Graph<EdgeProperties, CoEdgeProperties>

export const graphState = atom<RowHouseGraph>({
  key: "graph-state",
  default: graph.empty<EdgeProperties, CoEdgeProperties>(),
  effects: [sessionStorageEffect("graph-state")],
})
export type Selection = { type: "vertex" | "edge" | "co-edge"; id: string }
export const graphSelectionState = atom<Selection[]>({ key: "graph-selection", default: [] })

type GraphGlobalParams = {
  debug: {
    vertices: boolean
    coEdges: boolean
    edges: boolean
  }
}

export const graphGlobalParameters = atom<GraphGlobalParams>({
  key: "graph-global-parameters",
  default: {
    debug: {
      vertices: false,
      coEdges: false,
      edges: false,
    },
  },
})

export type ElementToGraphMap = Record<InternalPath, { urn: Urn; graph: { vertexIds: Id[]; edgeIds: Id[] } }>
export const elementToGraphMappingState = atom<ElementToGraphMap>({ key: "element-to-graph-map", default: {} })
