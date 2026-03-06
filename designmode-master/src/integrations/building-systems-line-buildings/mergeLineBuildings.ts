import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { moveGraphToCenterLine } from "./helpers/lineAlignment"
import type {
  SectionProps,
  CornerSectionProp,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { LineAlignment } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { Graph, GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"

export function getLastVertexInGraphLine(graph: Graph) {
  return Object.values(graph.vertices).find((vertex) => {
    return !Object.values(graph.edges).some((edge) => {
      return edge.start === vertex.id
    })
  })
}

export function getFirstVertexInGraphLine(graph: Graph) {
  return Object.values(graph.vertices).find((vertex) => {
    return !Object.values(graph.edges).some((edge) => {
      return edge.end === vertex.id
    })
  })
}

export function connectedTwoGraphs(
  graphOne: Graph,
  graphOneSide: "start" | "end",
  graphTwo: Graph,
  graphTwoSide: "start" | "end",
) {
  const flipDirectionOfFirstGraph = graphOneSide === graphTwoSide
  const connectionVertex = (
    graphOneSide === "end" ? getLastVertexInGraphLine(graphOne) : getFirstVertexInGraphLine(graphOne)
  ) as GraphVertex
  const removeVertex = (
    graphTwoSide === "end" ? getLastVertexInGraphLine(graphTwo) : getFirstVertexInGraphLine(graphTwo)
  ) as GraphVertex

  const vertices: Record<string, GraphVertex> = {}
  for (let vertex of Object.values(graphOne.vertices)) {
    vertices[vertex.id] = vertex
  }
  for (let vertex of Object.values(graphTwo.vertices)) {
    if (vertex.id === removeVertex.id) continue
    vertices[vertex.id] = vertex
  }

  const edges: Record<string, GraphEdge> = {}
  for (let edge of Object.values(graphOne.edges)) {
    if (flipDirectionOfFirstGraph) {
      edges[edge.id] = { ...edge, start: edge.end, end: edge.start }
    } else {
      edges[edge.id] = edge
    }
  }
  for (let edge of Object.values(graphTwo.edges)) {
    if (edge.start === removeVertex.id) {
      edges[edge.id] = { ...edge, start: connectionVertex.id }
    } else if (edge.end === removeVertex.id) {
      edges[edge.id] = { ...edge, end: connectionVertex.id }
    } else {
      edges[edge.id] = edge
    }
  }

  return { vertices, edges }
}

function closeGraph(graph: Graph, snapSide: "start" | "end") {
  const firstVertex = getFirstVertexInGraphLine(graph)
  const lastVertex = getLastVertexInGraphLine(graph)
  if (!firstVertex || !lastVertex) return graph

  const vertices: Record<string, GraphVertex> = {}
  for (let vertex of Object.values(graph.vertices)) {
    if (vertex.id === lastVertex.id && snapSide === "start") continue
    if (vertex.id === firstVertex.id && snapSide === "end") continue
    vertices[vertex.id] = vertex
  }

  const edges: Record<string, GraphEdge> = {}
  for (let edge of Object.values(graph.edges)) {
    if (edge.end === lastVertex.id && snapSide === "start") {
      edges[edge.id] = { ...edge, end: firstVertex.id }
      continue
    }
    if (edge.start === firstVertex.id && snapSide === "end") {
      edges[edge.id] = { ...edge, start: lastVertex.id }
      continue
    }
    edges[edge.id] = edge
  }
  return { vertices, edges }
}

function getOtherGraph(otherBuilding: OtherBuildingData, lineAlignment: "left" | "right" | "center", flipped: boolean) {
  if ((lineAlignment === "left" && flipped) || (lineAlignment === "right" && !flipped)) {
    return otherBuilding.rightGraph
  }
  if ((lineAlignment === "right" && flipped) || (lineAlignment === "left" && !flipped)) {
    return otherBuilding.leftGraph
  }
  return otherBuilding.centerGraph
}

export function getFlippedSectionProps(
  sectionProps: SectionProps,
  snapSide: "start" | "end",
  snapSide2: "start" | "end",
  graph: Graph,
) {
  if (snapSide !== snapSide2) {
    return sectionProps
  }
  const flippedSectionProps: SectionProps = {}
  for (let edge of Object.values(graph.edges)) {
    const n = Object.keys(sectionProps).filter((sectionId) => {
      return sectionId.split("::")[0] === edge.id
    }).length
    for (let i = 0; i < n; i++) {
      const sectionId = edge.id + "::" + i
      const sectionIdOld = edge.id + "::" + (n - 1 - i)
      flippedSectionProps[sectionId] = sectionProps[sectionIdOld]
    }
  }
  for (let sectionId of Object.keys(sectionProps)) {
    const vertexEdgeId = sectionId.split("::")[0]
    if (!graph.vertices[vertexEdgeId]) continue
    if (!sectionProps[sectionId]) continue
    const sectionProp = sectionProps[sectionId] as CornerSectionProp
    const startLeg = sectionProp.endLeg || 0
    const endLeg = sectionProp.startLeg || 0
    flippedSectionProps[sectionId] = { ...sectionProp, startLeg, endLeg }
  }
  return flippedSectionProps
}

export type OtherBuildingData = {
  centerGraph: Graph
  leftGraph: Graph
  rightGraph: Graph
  parameters: any
  worldTransform: Matrix4
}
export type OtherBuildingsData = Record<string, OtherBuildingData>

export function mergeGraphsOfLineBuildings({
  drawSideGraph,
  parameters,
  otherBuildingsData,
  drawingSnapData,
}: {
  drawSideGraph: Graph
  parameters: { lineAlignment: LineAlignment; width: number }
  otherBuildingsData: OtherBuildingsData
  drawingSnapData: { startSnap?: any; endSnap?: any }
}) {
  const { lineAlignment } = parameters
  const { startSnap, endSnap } = drawingSnapData

  let sideGraph = drawSideGraph
  if (startSnap?.path && otherBuildingsData[startSnap.path]) {
    const startBuilding = otherBuildingsData[startSnap.path]
    let startGraph = getOtherGraph(startBuilding, lineAlignment, startSnap.side === "start")
    sideGraph = connectedTwoGraphs(sideGraph, "start", startGraph, startSnap.side)
  }
  if (startSnap?.path && startSnap.path === endSnap?.path && otherBuildingsData[startSnap.path]) {
    sideGraph = closeGraph(sideGraph, endSnap.side)
  }

  if (endSnap?.path && otherBuildingsData[endSnap.path] && endSnap?.path !== startSnap?.path) {
    const endBuilding = otherBuildingsData[endSnap.path]

    let endGraph = getOtherGraph(endBuilding, lineAlignment, endSnap.side === "end")
    if (!startSnap) {
      sideGraph = connectedTwoGraphs(sideGraph, "end", endGraph, endSnap.side)
    } else if (startSnap?.side === "start") {
      sideGraph = connectedTwoGraphs(endGraph, endSnap.side, sideGraph, "start")
    } else {
      sideGraph = connectedTwoGraphs(endGraph, endSnap.side, sideGraph, "end")
    }
  }

  let mergedLineAlignment = lineAlignment
  if (lineAlignment === "left" && startSnap?.side === "start") mergedLineAlignment = "right"
  if (lineAlignment === "right" && startSnap?.side === "start") mergedLineAlignment = "left"
  if (lineAlignment === "left" && !startSnap && endSnap?.side === "end") mergedLineAlignment = "right"
  if (lineAlignment === "right" && !startSnap && endSnap?.side === "end") mergedLineAlignment = "left"

  return { sideGraph, lineAlignment: mergedLineAlignment }
}

export function mergeLineBuildings(
  lineBuilding: any,
  otherBuildingsData: OtherBuildingsData,
  snappingData: { startSnap?: any; endSnap?: any },
) {
  const { lineAlignment, width } = lineBuilding
  const { startSnap, endSnap } = snappingData

  const drawGraph = lineBuilding.graph
  let graph = drawGraph
  let sectionProps: SectionProps = {}

  if (startSnap?.path && otherBuildingsData[startSnap.path]) {
    const startBuilding = otherBuildingsData[startSnap.path]
    const startParams = startBuilding.parameters as LineBuildingParameters
    let startGraph = getOtherGraph(startBuilding, lineAlignment, startSnap.side === "start")
    graph = connectedTwoGraphs(drawGraph, "start", startGraph, startSnap.side)
    const startSectionProps = startParams.sectionProps
    sectionProps = { ...sectionProps, ...startSectionProps }
  }
  if (startSnap?.path && startSnap.path === endSnap?.path && otherBuildingsData[startSnap.path]) {
    graph = closeGraph(graph, endSnap.side)
  }

  if (endSnap?.path && otherBuildingsData[endSnap.path] && endSnap?.path !== startSnap?.path) {
    const endBuilding = otherBuildingsData[endSnap.path]
    const endParams = endBuilding.parameters as LineBuildingParameters

    let endGraph = getOtherGraph(endBuilding, lineAlignment, endSnap.side === "end")
    if (!startSnap) {
      graph = connectedTwoGraphs(graph, "end", endGraph, endSnap.side)
      const endSectionProps = endParams.sectionProps
      sectionProps = { ...sectionProps, ...endSectionProps }
    } else if (startSnap?.side === "start") {
      graph = connectedTwoGraphs(endGraph, endSnap.side, graph, "start")
      const endSectionProps = getFlippedSectionProps(endParams.sectionProps, "start", endSnap.side, endGraph)
      sectionProps = { ...sectionProps, ...endSectionProps }
    } else {
      graph = connectedTwoGraphs(endGraph, endSnap.side, graph, "end")
      const endSectionProps = getFlippedSectionProps(endParams.sectionProps, "end", endSnap.side, endGraph)
      sectionProps = { ...sectionProps, ...endSectionProps }
    }
  }

  let mergedLineAlignment = lineAlignment
  if (lineAlignment === "left" && startSnap?.side === "start") mergedLineAlignment = "right"
  if (lineAlignment === "right" && startSnap?.side === "start") mergedLineAlignment = "left"
  if (lineAlignment === "left" && !startSnap && endSnap?.side === "end") mergedLineAlignment = "right"
  if (lineAlignment === "right" && !startSnap && endSnap?.side === "end") mergedLineAlignment = "left"

  graph = moveGraphToCenterLine(graph, { width, lineAlignment: mergedLineAlignment })

  const customLayouts = []
  if (startSnap) {
    const startBuilding = otherBuildingsData[startSnap.path]
    customLayouts.push(...startBuilding.parameters.customLayouts)
  }
  if (endSnap) {
    const endBuilding = otherBuildingsData[endSnap.path]
    customLayouts.push(...endBuilding.parameters.customLayouts)
  }

  return { ...lineBuilding, graph, sectionProps, customLayouts, lineAlignment: mergedLineAlignment }
}

export function transformGraph(graph: Graph, worldTransform: Matrix4) {
  const vertices: Record<string, GraphVertex> = {}
  for (let vertex of Object.values(graph.vertices)) {
    const point = new Vector3(vertex.x, vertex.y).applyMatrix4(worldTransform)
    vertices[vertex.id] = { ...vertex, x: point.x, y: point.y }
  }

  return { ...graph, vertices }
}
