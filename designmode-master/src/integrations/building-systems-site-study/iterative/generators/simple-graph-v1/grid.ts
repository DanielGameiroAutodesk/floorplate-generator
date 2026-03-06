import { Box2, Matrix3, Vector2 } from "three"
import { v4 as uuidv4 } from "uuid"

import ArrayUtils from "src/lib/array"

import { getGraphCutToBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection"
import { getVertexEdgeMap } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2"
import { getGraphToBuildingLimitMap } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/splitBuildingLimit"
import { polygonToGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/graphHelpers"

import type { Polygon, SimpleGraph, Vertex } from "./types"

export type GridParams = {
  dx: number
  dy?: number // Defaults to value of dx
  angle: number
  origin: { x: number; y: number }
}

export function getDefaultGridParamsBasedOfNode(polygons: Polygon[]) {
  const polygon = polygons.flat(1)
  const longestEdge = ArrayUtils.sliding2([...polygon, polygon[0]]).reduce<
    { dist: number; a: [number, number]; b: [number, number] } | undefined
  >((prev, [a, b]) => {
    const dist = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
    if (!prev || dist > prev.dist) {
      return { dist, a, b }
    }
    return prev
  }, undefined)

  if (!longestEdge) return defaultGridParams

  return {
    dx: 100,
    origin: { x: longestEdge.a[0], y: longestEdge.a[1] },
    angle: Math.atan2(longestEdge.b[1] - longestEdge.a[1], longestEdge.b[0] - longestEdge.a[0]),
  }
}

export const defaultGridParams = {
  dx: 100,
  angle: 0,
  origin: { x: 0, y: 0 },
} satisfies GridParams

export function createAxisAlignedGridInBox2(
  box: Box2,
  dx: number,
  dy?: number,
  skipCenter: boolean = false,
): SimpleGraph {
  const vertices: { x: number; y: number }[] = []
  const edges: { start: number; end: number }[] = []

  const delta = new Vector2(Math.max(dx, 20), Math.max(dy ?? dx, 20))

  const stepStart = new Vector2(box.min.x / delta.x, box.min.y / delta.y).floor()
  const stepEnd = new Vector2(box.max.x / delta.x, box.max.y / delta.y).ceil()

  const xs = []
  const ys = []

  for (let ix = stepStart.x; ix <= stepEnd.x; ix++) {
    if (skipCenter && ix === 0) continue
    xs.push(ix * delta.x)
  }

  for (let iy = stepStart.y; iy <= stepEnd.y; iy++) {
    if (skipCenter && iy === 0) continue
    ys.push(iy * delta.y)
  }

  for (let iy = 0; iy < ys.length; iy++) {
    for (let ix = 0; ix < xs.length; ix++) {
      const i = ix + iy * xs.length
      vertices.push({ x: xs[ix], y: ys[iy] })

      if (ix !== xs.length - 1) {
        edges.push({ start: i, end: i + 1 })
      }
      if (iy !== ys.length - 1) {
        edges.push({ start: i, end: i + xs.length })
      }
    }
  }

  const vertexIds = vertices.map(() => uuidv4())
  const edgeIds = edges.map(() => uuidv4())

  return {
    vertices: Object.fromEntries(vertices.map((vertex, i) => [vertexIds[i], { id: vertexIds[i], ...vertex }])),
    edges: Object.fromEntries(
      edges.map(({ start, end }, i) => [edgeIds[i], { id: edgeIds[i], start: vertexIds[start], end: vertexIds[end] }]),
    ),
  }
}

export function transformPolygon(polygon: Polygon, matrix: Matrix3): Polygon {
  return polygon
    .map((coord) => new Vector2(coord[0], coord[1]).applyMatrix3(matrix))
    .map((v): [number, number] => [v.x, v.y])
}

export function transformGraph(graph: SimpleGraph, matrix: Matrix3): SimpleGraph {
  return {
    ...graph,
    vertices: Object.fromEntries(
      Object.entries(graph.vertices).map(([vid, vertex]): [string, Vertex] => {
        const globalVertex2 = new Vector2(vertex.x, vertex.y).applyMatrix3(matrix)
        return [vid, { id: vid, x: globalVertex2.x, y: globalVertex2.y }]
      }),
    ),
  }
}

export function generateGridForPolygon(polygon: Polygon, { dx, dy, angle, origin }: GridParams): SimpleGraph {
  const matrix = new Matrix3()
    .premultiply(new Matrix3().makeTranslation(-origin.x, -origin.y))
    .premultiply(new Matrix3().makeRotation(-angle))

  const matrixInverse = matrix.clone().invert()

  // Everything below is in local coordinate system
  const tPolygon = transformPolygon(polygon, matrix)

  const tBox = tPolygon.reduce<Box2>(
    (prev, [x, y]) => prev.expandByPoint(new Vector2(x, y)),
    new Box2(new Vector2(Infinity, Infinity), new Vector2(-Infinity, -Infinity)),
  )

  const graph = createAxisAlignedGridInBox2(tBox, dx, dy)

  const graphCutToBuildingLimits = getGraphCutToBuildingLimits(graph, [tPolygon]) as SimpleGraph
  const cleaned = cleanGrid(graphCutToBuildingLimits, tPolygon)

  return transformGraph(cleaned, matrixInverse)
}

// Copied from src/integrations/building-systems-site-study/generator/sketchStuff/partitions/generateGrids.js and modified slightly
export function cleanGrid(cellGraph: SimpleGraph, buildingLimit: Polygon) {
  const vertices = { ...cellGraph.vertices }
  const edges = { ...cellGraph.edges }

  const vertexEdgeMap = getVertexEdgeMap(vertices, edges)

  const verticesAtBuildingLimit: string[] = []
  const buildingLimitMapping = getGraphToBuildingLimitMap(
    { vertices, edges },
    polygonToGraph(buildingLimit),
    buildingLimit,
  )
  Object.values(buildingLimitMapping.splittedEdges).forEach((edge) => {
    // @ts-expect-error no-description
    if (vertices[edge.start]) verticesAtBuildingLimit.push(edge.start)
    // @ts-expect-error no-description
    if (vertices[edge.end]) verticesAtBuildingLimit.push(edge.end)
  })
  // @ts-expect-error no-description
  Object.values(buildingLimitMapping.vertexMap).forEach((vertex) => verticesAtBuildingLimit.push(vertex))

  const freeVertices = Object.keys(vertices).filter(
    // @ts-expect-error no-description
    (id) => vertexEdgeMap[id].length === 1 && !verticesAtBuildingLimit.includes(id),
  )
  freeVertices.forEach((id) => delete vertices[id])
  Object.values(edges).forEach((edge) => {
    if (!vertices[edge.start] || !vertices[edge.end]) {
      delete edges[edge.id]
    }
  })

  const updatedVertexEdgeMap = getVertexEdgeMap(vertices, edges)

  Object.keys(updatedVertexEdgeMap)
    // @ts-expect-error no-description
    .filter((vertexID) => updatedVertexEdgeMap[vertexID].length === 0)
    .forEach((ID) => {
      delete vertices[ID]
    })

  return { vertices, edges }
}

function mergeDisjunctGraphs(graphs: SimpleGraph[]): SimpleGraph {
  return {
    vertices: Object.fromEntries(graphs.flatMap((graph) => Object.entries(graph.vertices))),
    edges: Object.fromEntries(graphs.flatMap((graph) => Object.entries(graph.edges))),
  }
}

export function generateGridSimple(polygons: Polygon[], gridParams: GridParams): SimpleGraph {
  return mergeDisjunctGraphs(polygons.map((polygon) => generateGridForPolygon(polygon, gridParams)))
}
