import {
  connectedTwoGraphs,
  getFlippedSectionProps,
} from "src/integrations/building-systems-line-buildings/mergeLineBuildings"
import type { Vector3 } from "three"
import type { Graph, GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"

function pickOtherBuildingGraph(
  otherBuilding: any,
  otherBuildingSide: "start" | "end",
  dragBuildingSide: "start" | "end",
  lineAlignment: "center" | "left" | "right",
) {
  if (lineAlignment === "center") return otherBuilding.centerGraph
  if (otherBuildingSide !== dragBuildingSide) {
    if (lineAlignment === "left") return otherBuilding.leftGraph
    if (lineAlignment === "right") return otherBuilding.rightGraph
  } else {
    if (lineAlignment === "left") return otherBuilding.rightGraph
    if (lineAlignment === "right") return otherBuilding.leftGraph
  }
}

function getUpdatedGraphAfterMerge(graph: Graph, dragVertexData: any, otherBuildingsSnapData: any, parameters: any) {
  const lineAlignment: "center" | "left" | "right" = parameters.lineAlignment

  const dragBuildingSide = dragVertexData.dragVertexType === "startDrag" ? "start" : "end"
  const path = dragVertexData.otherBuildingSnapData.path
  const otherBuildingSide = dragVertexData.otherBuildingSnapData.side
  const otherBuilding = otherBuildingsSnapData.otherBuildingsData[path]
  const otherBuildingParameters = otherBuilding.parameters
  const otherBuildingGraph = pickOtherBuildingGraph(otherBuilding, otherBuildingSide, dragBuildingSide, lineAlignment)

  const mergedGraph = connectedTwoGraphs(otherBuildingGraph, otherBuildingSide, graph, dragBuildingSide)

  const otherBuildingSectionProps = getFlippedSectionProps(
    otherBuildingParameters.sectionProps,
    otherBuildingSide,
    dragBuildingSide,
    otherBuildingGraph,
  )
  const sectionProps = { ...parameters.sectionProps, ...otherBuildingSectionProps }

  const customLayouts = [...parameters.customLayouts, ...otherBuildingParameters.customLayouts]
  const mergesParameters = { ...parameters, sectionProps, customLayouts }
  return { graph: mergedGraph, parameters: mergesParameters }
}

export function getUpdatedGraphAfterVertexDrag(
  graph: Graph,
  dragVertexData:
    | {
        snappedPosition: Vector3
        dragVertexId: string
        snappedToVertexId?: string | undefined
        dragVertexType: "startDrag" | "midDrag" | "endDrag"
        otherBuildingSnapData?: any
      }
    | undefined,
  draggingVertex: boolean,
  otherBuildingsSnapData: any,
  parameters: any,
): { graph: Graph; parameters: any } {
  if (!dragVertexData || !draggingVertex) return { graph, parameters }
  if (dragVertexData.snappedToVertexId && Object.values(graph.vertices).length <= 2) return { graph, parameters }
  if (dragVertexData?.otherBuildingSnapData) {
    return getUpdatedGraphAfterMerge(graph, dragVertexData, otherBuildingsSnapData, parameters)
  }
  const { dragVertexId, snappedToVertexId, snappedPosition } = dragVertexData
  let updatedVertices: Record<string, GraphVertex> = {}
  Object.values(graph.vertices).forEach((vertex) => {
    if (vertex.id !== dragVertexId && vertex.id !== snappedToVertexId) {
      updatedVertices[vertex.id] = vertex
    } else if (vertex.id === dragVertexId) {
      updatedVertices[vertex.id] = { ...vertex, x: snappedPosition.x, y: snappedPosition.y }
    }
  })
  let updatedEdges: Record<string, GraphEdge> = {}
  for (let edge of Object.values(graph.edges)) {
    if (snappedToVertexId !== edge.start && snappedToVertexId !== edge.end) {
      updatedEdges[edge.id] = edge
    } else if (dragVertexId !== edge.start && dragVertexId !== edge.end) {
      updatedEdges[edge.id] =
        snappedToVertexId === edge.start ? { ...edge, start: dragVertexId } : { ...edge, end: dragVertexId }
    }
  }
  const updatedGraph = { ...graph, edges: updatedEdges, vertices: updatedVertices }
  return { graph: updatedGraph, parameters }
}
