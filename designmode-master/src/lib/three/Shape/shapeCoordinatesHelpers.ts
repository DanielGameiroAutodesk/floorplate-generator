import type { Vector3 } from "three"
import type { Edge, Shape } from "./types"

function closePolygon(polygon: number[][]): number[][] {
  if (polygon.length === 0) return polygon
  const first = polygon[0]
  const last = polygon[polygon.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return polygon
  return [...polygon, polygon[0]]
}

function isClockwise(poly: number[][]) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

function loopToPolygon(loop: number[], edges: Edge[], vertices: Vector3[]) {
  if (loop.length > 0) {
    let prevEdge = edges[loop[loop.length - 1]]
    const polygon = []
    for (const edgeIndex of loop) {
      const vertexIndex =
        edges[edgeIndex][0] == prevEdge[0] || edges[edgeIndex][0] == prevEdge[1]
          ? edges[edgeIndex][0]
          : edges[edgeIndex][1]

      prevEdge = edges[edgeIndex]
      const vertex = vertices[vertexIndex]
      const point = [vertex.x, vertex.y]
      polygon.push(point)
    }
    return polygon
  } else {
    return []
  }
}

function areaOfPolygon(polygon: number[][]) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0[0] * p1[1] - p1[0] * p0[1])
  }

  return area
}

export function shapeLoopsToCoordinates(shape: Shape): number[][][] {
  const polygons = []
  const { edges, vertices, loops } = shape
  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i]
    const poly = loopToPolygon(loop, edges, vertices)
    polygons.push(poly)
  }
  const areas = polygons.map((polygon) => areaOfPolygon(polygon))
  const indexOfLargest = areas.reduce(
    (acc, area, index) => {
      if (area > acc.area) return { area, index }
      return acc
    },
    { area: 0, index: 0 },
  ).index
  const groundPolygon = closePolygon(polygons[indexOfLargest])
  if (isClockwise(groundPolygon)) groundPolygon.reverse()

  const holes = polygons
    .filter((_, i) => i !== indexOfLargest)
    .map((polygon) => {
      const closed = closePolygon(polygon)
      if (!isClockwise(closed)) closed.reverse()
      return closed
    })
  return [groundPolygon, ...holes]
}
