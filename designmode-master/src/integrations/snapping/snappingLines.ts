import type { Feature } from "geojson"
import type { Box3, Matrix4 } from "three"
import { Vector3 } from "three"
import type { SnappingLine } from "./snapping"
import ArrayUtils from "src/lib/array"
import { snappingLineFromEndpoints } from "./snappingEngineHelpers"
import { closePolygon } from "src/lib/three/polygon"
import type { Coord3D } from "src/lib/geometry/geometryTypes"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"

export const vectorsToSnappingLineBbox = (
  vectors: Vector3[],
  onTerrain: boolean,
  terrain: TerrainSamplerData | undefined,
): SnappingLine[] => {
  const pairs = ArrayUtils.sliding2(vectors)

  return pairs.flatMap(([from, to]) => snappingLineFromEndpoints(from, to, "LINE", onTerrain, terrain))
}

export const planeToSnappingLinesBbox = (plane: number[][]): SnappingLine[] => {
  const verticesInPlane: Vector3[] = closePolygon(plane.map(([x, y, z]) => new Vector3(x, y, z)))
  return vectorsToSnappingLineBbox(verticesInPlane, false, undefined)
}

export const polygonFromBoundingBox = (bbox: Box3): Coord3D[] => {
  const minX = bbox.min.x
  const minY = bbox.min.y
  const maxX = bbox.max.x
  const maxY = bbox.max.y
  const z = bbox.min.z
  return [
    [minX, minY, z],
    [minX, maxY, z],
    [maxX, maxY, z],
    [maxX, minY, z],
  ]
}

export function snappingLinesForShapeOnTerrain(
  footprint: Feature | undefined,
  matrixWorld: Matrix4,
  shapeId: string,
  terrain?: TerrainSamplerData,
): SnappingLine[] {
  if (
    !footprint ||
    (footprint.geometry.type !== "Polygon" && footprint.geometry.type !== "LineString") ||
    footprint.properties?.height !== undefined
  )
    return []
  const loop =
    footprint.geometry.type === "Polygon" ? footprint.geometry.coordinates[0] : footprint.geometry.coordinates
  const segments = ArrayUtils.sliding2(
    loop
      .concat([loop[0]])
      .map(([x, y]) => new Vector3(x, y))
      .map((v) => v.applyMatrix4(matrixWorld)),
  )
  return segments.map(([start, end]) => {
    return snappingLineFromEndpoints(start, end, "LINE", true, terrain, shapeId)
  })
}
