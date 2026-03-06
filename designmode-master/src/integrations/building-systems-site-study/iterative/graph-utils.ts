import ArrayUtils from "src/lib/array"

import { edgeIDsToBufferWidth } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellHelpers"
import { bufferPolygonWithVaryingOffsets } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/polygonBuffer"

import { graphToInnerPolygons } from "./graphToInnerPolygons"
import { graphToOuterPolygons } from "./graphToOuterPolygons"

type Polygon = [number, number][]
type Vertex = { x: number; y: number; id: string }
type Edge<T = object> = { start: string; end: string; id: string } & T
type Vertices = { [id: string]: Vertex }
type Edges<T = object> = { [id: string]: Edge<T> }

export type SimpleGraph<T = object> = { vertices: Vertices; edges: Edges<T> }

export function createPolygonCellsFromGraph(graph: SimpleGraph<{ width: number }>): Polygon[] {
  const polygonsWithBelongingEdgeIDs = graphToInnerPolygons(graph)
  const bufferedPolygons = polygonsWithBelongingEdgeIDs.flatMap((polygonAndEdgeIDs) => {
    const { polygon, edgeIDs } = polygonAndEdgeIDs
    const bufferWidths = edgeIDsToBufferWidth(edgeIDs, graph.edges)
    const bufferedPolygons = bufferPolygonWithVaryingOffsets(polygon, bufferWidths) as Polygon[]
    return bufferedPolygons
  })
  return bufferedPolygons.map(removeNonCornersFromPolygon)
}

export function createOuterPolygonsFromGraph(graph: SimpleGraph): Polygon[] {
  const outerPolygons = graphToOuterPolygons(graph)
  return outerPolygons.map(removeNonCornersFromPolygon)
}

const REMOVE_CORNER_THRESHOLD_RAD = 1e-12

function removeNonCornersFromPolygon(polygon: Polygon): Polygon {
  if (polygon.length < 3) return polygon
  const firstPoint = polygon[0]
  const lastPoint = polygon.at(-1)!
  const isClosed = firstPoint[0] == lastPoint[0] && firstPoint[1] == lastPoint[1]
  const unclosedPolygon = isClosed ? polygon.slice(0, -1) : polygon
  const lastActualPoint = unclosedPolygon.at(-1)!
  const extendedPolygon = [lastActualPoint, ...unclosedPolygon, firstPoint]
  const cornerPoints = ArrayUtils.sliding3(extendedPolygon)
  const normalizeAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  const cornerTurns = cornerPoints.map(([lastPoint, currentPoint, nextPoint]) => {
    const incomingDirection = Math.atan2(currentPoint[1] - lastPoint[1], currentPoint[0] - lastPoint[0])
    const outgoingDirection = Math.atan2(nextPoint[1] - currentPoint[1], nextPoint[0] - currentPoint[0])
    const turn = normalizeAngle(outgoingDirection - incomingDirection)
    return turn
  })
  const pointsToDelete = new Set(
    cornerTurns.flatMap((turn, i) => (Math.abs(turn) < REMOVE_CORNER_THRESHOLD_RAD ? [i] : [])),
  )
  const unclosedFilteredPolygon = unclosedPolygon.filter((_, i) => !pointsToDelete.has(i))
  if (unclosedFilteredPolygon.length < 3) return polygon
  const closedFilteredPolygon = [...unclosedFilteredPolygon, unclosedFilteredPolygon[0]]
  return closedFilteredPolygon
}

export function isGraphWithEdgesWidth(graph: SimpleGraph<any>): graph is SimpleGraph<{ width: number }> {
  return Object.values(graph.edges).every((edge) => "width" in edge)
}

export function createGraphWithEdgesWidth(graph: SimpleGraph, width: number): SimpleGraph<{ width: number }> {
  return {
    ...graph,
    edges: Object.entries(graph.edges).reduce(
      (acc, [id, edge]) => {
        acc[id] = { ...edge, width }
        return acc
      },
      {} as Edges<{ width: number }>,
    ),
  }
}
