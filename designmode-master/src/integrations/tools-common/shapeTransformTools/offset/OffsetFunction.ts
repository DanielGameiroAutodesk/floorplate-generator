import type { Position } from "geojson"
import offsetPolygon from "offset-polygon"
import { Vector3 } from "three"

const first = new Vector3()
const last = new Vector3()
export default function OffsetPolygon(polygon: Position[], radius: number): Position[] {
  let vertices = polygon.map(([x, y]) => ({ x, y }))
  first.set(vertices[0].x, vertices[0].y, 0)
  last.set(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y, 0)
  let closed = first.equals(last)
  if (closed) {
    vertices.pop()
  }
  let buffered = offsetPolygon(vertices, radius, 0)
  const result = buffered.map(({ x, y }) => [x, y])

  if (closed) {
    result.push(result[0])
  }
  return result
}
