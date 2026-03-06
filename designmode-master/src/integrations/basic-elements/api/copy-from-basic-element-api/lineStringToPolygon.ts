import { Vector2 } from "three"
import type { Feature, LineString } from "geojson"
import type { TerrainShape } from "src/lib/element/types"

const polygonsFromLineString = (vec2s: Vector2[], buffer: number) => {
  const edgeVecs = vec2s.slice(1).map((v, i) => v.clone().sub(vec2s[i]))
  const edgeVecsNormalized = edgeVecs.map((v) => v.clone().normalize())
  const angleSines = edgeVecsNormalized.slice(1).map((v, i) => v.cross(edgeVecsNormalized[i]))

  const polygons: [number, number][][] = []
  for (let i = 0; i < vec2s.length - 2; i++) {
    const v0 = vec2s[i]
    const v1 = vec2s[i + 1]
    polygons.push(bufferLineSegment(v0, v1, buffer))
    const orthogonal1 = new Vector2(-edgeVecsNormalized[i].y, edgeVecsNormalized[i].x)
    const orthogonal2 = new Vector2(-edgeVecsNormalized[i + 1].y, edgeVecsNormalized[i + 1].x)
    if (Math.abs(angleSines[i]) > 0.0001) polygons.push(bufferCorner(v1, orthogonal1, orthogonal2, buffer))
  }
  if (vec2s.length > 1) {
    const lastPoint = vec2s[vec2s.length - 1]
    const secondToLastPoint = vec2s[vec2s.length - 2]
    polygons.push(bufferLineSegment(secondToLastPoint, lastPoint, buffer))
  }
  return polygons
}

function bufferLineSegment(start: Vector2, end: Vector2, buffer: number): [number, number][] {
  const normal = new Vector2(-end.y + start.y, end.x - start.x).normalize()
  return [
    [start.x - normal.x * (buffer / 2), start.y - normal.y * (buffer / 2)],
    [end.x - normal.x * (buffer / 2), end.y - normal.y * (buffer / 2)],
    [end.x + normal.x * (buffer / 2), end.y + normal.y * (buffer / 2)],
    [start.x + normal.x * (buffer / 2), start.y + normal.y * (buffer / 2)],
  ]
}

function bufferCorner(corner: Vector2, normal1: Vector2, normal2: Vector2, buffer: number) {
  const turn = normal1.cross(normal2) > 0 ? -1 : 1
  const offset1 = normal1.clone().multiplyScalar(turn * (buffer / 2))
  const offset2 = normal2.clone().multiplyScalar(turn * (buffer / 2))
  return [corner.clone().add(offset1).toArray(), corner.clone().add(offset2).toArray(), corner.toArray()]
}

export const generatePolygonsFromLineString = (feature: Feature<LineString>, roadWidth: number): TerrainShape => {
  const { id, geometry } = feature
  const coordinates = geometry.coordinates as [number, number][]
  const vec2s = coordinates.map(([x, y]) => new Vector2(x, y))
  const polygons = polygonsFromLineString(vec2s, roadWidth)
  return {
    type: "FeatureCollection",
    features: polygons.map((polygon) => ({
      id,
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [polygon],
      },
      properties: {
        category: "road",
        fill: { color: "#999999", opacity: 1 },
      },
    })),
  }
}
