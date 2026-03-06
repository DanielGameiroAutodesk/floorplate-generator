import type { Urn } from "@spacemakerai/element-types"
import ParcelTemplateAPI from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import type { Graph as GraphType } from "src/integrations/composition-site-graph/graph/types"
import Graph from "src/integrations/composition-site-graph/graph/graph"
import ArrayUtils from "src/lib/array"
import CurrentTemplate from "src/integrations/composition-site-graph-parcel/templates/CurrentTemplate"
import { addRowHousePropertiesToSide } from "src/integrations/composition-site-graph/graph-element/housingGraph"
import type { PlacementSide } from "src/integrations/composition-site-graph/graph-element/types"
import { DEFAULT_BUFFER, DEFAULT_PLACEMENT_SIDE } from "src/integrations/composition-site-graph/graph-element/types"
import Composition from "src/integrations/composition-site-graph/graph-element/composition"
import {
  parametricElementClient,
  type ParametricElementFormaElement,
} from "src/integrations/parametric-element-system/parametricElementClient"
import { isOk } from "src/core/elements-saving/result"
import GraphInternal from "src/integrations/composition-site-graph/graph/graph-internal"
import { objectKeys } from "src/lib/record"
import { PROJECT_ID } from "src/core/project/project"
import { computed } from "@preact/signals"
import type { ReadonlySignalHack } from "src/lib/signal"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type Point = [number, number]
type LineString = Point[]
type TemplateId = string

type Template = {
  templateId: string
  name: string
}

interface HousingAPI {
  /**
   * Creates a housing line, just like the one you can create in the Forma UI.
   * @param line - The line to create a housing line from.
   * @param buffer - The distance from the line to where the housing should be placed.
   * @param placementSide - Which side should the housing be placed on – the left of the line, or the right of the line.
   * @param templateId - The template to use for the housing line. If not provided, the template that is currently selected in the UI will be used.
   */
  createHousingLine(
    this: void,
    line: LineString,
    buffer?: number,
    placementSide?: Extract<PlacementSide, "left" | "right">,
    templateId?: TemplateId,
  ): Promise<Urn>

  templatesSignal: ReadonlySignalHack<Template[] | undefined>
}

export const housingApi: HousingAPI = {
  async createHousingLine(
    line: LineString,
    buffer: number = DEFAULT_BUFFER,
    placementSide: Extract<PlacementSide, "left" | "right"> = DEFAULT_PLACEMENT_SIDE,
    templateId?: TemplateId,
  ): Promise<Urn> {
    const template = templateId
      ? ParcelTemplateAPI.templatesSignal.peek()?.[templateId]
      : CurrentTemplate.templateSignal.peek()
    if (!template) {
      throw new Error("Could not find template")
    }
    const graph = lineStringToGraph(line)
    const rowHouseGraph = addRowHousePropertiesToSide(graph, template, { buffer, placementSide })
    const composition = Composition.create(rowHouseGraph, template, terrainSignal.peek().elevationAt)

    const result = await parametricElementClient.saveLowLevel(
      Array.from(composition.elements.values(), (item) => ({
        element: item as ParametricElementFormaElement,
        volumeMesh: composition.representations.volumeMesh.get(item.urn),
      })),
      PROJECT_ID,
    )
    if (result.every(isOk)) {
      return composition.rootUrn
    } else {
      throw new Error("Could not save housing line due to saving error")
    }
  },
  /**
   * Since templates are loaded some time after the page is loaded (specifically, 3 seconds) and we don't know when this function will be called in the lifecycle, we need to wait for them to be loaded.
   */
  templatesSignal: computed(() => {
    const value = ParcelTemplateAPI.templatesSignal.value
    return value ? Object.values(value).map((t) => ({ templateId: t.id, name: t.name })) : undefined
  }),
}

export function useHousingAPI(): HousingAPI {
  return housingApi
}

function lineStringToGraph(line: LineString): GraphType {
  const graph = ArrayUtils.sliding2(line).reduce(
    (prev, points) => {
      const [current, next] = points
      let graph0 = prev.graph
      let currVertexId = prev.currVertexId
      if (!currVertexId) {
        const graphWithVertex = Graph.addVertex(prev.graph, current[0], current[1])
        graph0 = graphWithVertex[0]
        currVertexId = graphWithVertex[1]
      }
      const [graph2, nextVertexId] = Graph.addVertex(graph0, next[0], next[1])
      const [graph3] = Graph.addEdge(graph2, currVertexId, nextVertexId)
      return { graph: graph3, currVertexId: nextVertexId }
    },
    { graph: Graph.empty(), currVertexId: undefined } as { graph: GraphType; currVertexId?: string },
  ).graph
  return GraphInternal._updateInternals(graph, objectKeys(graph.edges))
}
