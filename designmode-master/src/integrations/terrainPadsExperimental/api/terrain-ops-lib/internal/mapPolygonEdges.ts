import type { Vec3 } from "./utils"

export type PolygonEdgesMappedToXIntervals = {
  intervalsX: number[]
  edgeIdxesPerInterval: number[][]
  edges: [[number, number], [number, number]][]
  polygon?: Vec3[]
}

export function mapLoopsEdgesToXIntervals(
  loopsEdges: [[number, number], [number, number]][],
): PolygonEdgesMappedToXIntervals {
  const interestPointsX = Array.from(new Set(loopsEdges.map((c) => c[0][0]))).sort((a, b) => a - b)
  const edges = loopsEdges
    .map(
      (edge) =>
        edge.slice().sort((a: [number, number], b: [number, number]) => a[0] - b[0]) as [
          [number, number],
          [number, number],
        ],
    )
    .sort((a, b) => a[0][0] - b[0][0])
  const edgeIdxesPerInterval = buildEdgeIdxesPerInterval(interestPointsX, edges)
  return { intervalsX: interestPointsX, edgeIdxesPerInterval, edges }
}

export function mapPolygonEdgesToXIntervals(polygon: Vec3[]): PolygonEdgesMappedToXIntervals {
  const interestPointsX = Array.from(new Set(polygon.map((c) => c.x))).sort((a, b) => a - b)

  const edges: [[number, number], [number, number]][] = []
  for (let i = 0; i < polygon.length; i++) {
    const edge = [
      [polygon[i].x, polygon[i].y],
      [polygon[(i + 1) % polygon.length].x, polygon[(i + 1) % polygon.length].y],
    ]
    edges.push(edge.sort((a, b) => a[0] - b[0]) as [[number, number], [number, number]])
  }
  edges.sort((a, b) => a[0][0] - b[0][0])

  const edgeIdxesPerInterval: number[][] = buildEdgeIdxesPerInterval(interestPointsX, edges)
  return { intervalsX: interestPointsX, edgeIdxesPerInterval, edges, polygon }
}
function findIntervalIdx(x: number, orderedSequence: number[]): number {
  if (x < orderedSequence[0] || x > orderedSequence[orderedSequence.length - 1]) return -1
  let l = 0
  let r = orderedSequence.length - 1
  while (l < r - 1) {
    let m = Math.floor((l + r) / 2)
    if (orderedSequence[m] <= x) l = m
    else r = m
  }
  return l
}

export function isPointInsideMappedEdgesPolygon(
  point: [number, number],
  mappedEdges: PolygonEdgesMappedToXIntervals,
): boolean {
  const { intervalsX, edgeIdxesPerInterval, edges } = mappedEdges
  const [x, y] = point
  const intervalIdx = findIntervalIdx(x, intervalsX)
  if (intervalIdx === -1) return false

  const edgeIdxes = edgeIdxesPerInterval[intervalIdx]
  let inside = false
  for (const edgeIdx of edgeIdxes) {
    let edge = edges[edgeIdx]
    let x1 = edge[0][0]
    let y1 = edge[0][1]
    let x2 = edge[1][0]
    let y2 = edge[1][1]
    if (y < ((y2 - y1) * (x - x1)) / (x2 - x1) + y1) inside = !inside
  }
  return inside
}

function buildEdgeIdxesPerInterval(interestPointsX: number[], edges: [[number, number], [number, number]][]) {
  let startidx = 0
  const edgeIdxesPerInterval: number[][] = interestPointsX.slice(1).map(() => [])
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i]
    for (let j = startidx; interestPointsX[startidx] < edge[0][0]; j++) startidx++
    for (let j = startidx; interestPointsX[j] < edge[1][0]; j++) {
      edgeIdxesPerInterval[j].push(i)
    }
  }
  return edgeIdxesPerInterval
}
