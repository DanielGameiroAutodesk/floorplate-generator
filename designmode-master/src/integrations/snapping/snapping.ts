import type { Triangle, Vector3 } from "three"
import { Box3, Sphere } from "three"
import type { InternalPath } from "src/lib/element/path"
import type { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import { getBottomLinesAndPoints } from "./snapping-lib"

export type AffineSnap = {
  id: string
  lines: { v1: Vector3; v2: Vector3 }[]
  points: Vector3[]
  bbox: Box3 // [minx, miny, minz, maxx, maxy, maxz]
  boundingSphere: Sphere
  onTerrain?: boolean
}

export type LineSnapType =
  | "LINE"
  | "LINE_EXTENSION"
  | "PARALLEL"
  | "ORTHOGONAL"
  | "CENTER_ORTHOGONAL"
  | "ENDPOINT_RIGHT_ANGLE"

export type Segment3 = {
  start: Vector3
  end: Vector3
  bbox: Box3
}

export type SnappingLine = {
  type: LineSnapType
  start: Vector3
  end: Vector3
  center: Vector3
  onTerrain: boolean
  segments: Segment3[]
  shapeId: string
  refLines?: SnappingLine[]
}

export type SnapInfo = {
  lines: SnappingLine[]
  affineSnapInfo: AffineSnap
  roofAndFloorTriangles: Triangle[]
  octree: BBoxOctree<SnappingLine>
}

export function getAffineSnapFromSnappingLines(lines: SnappingLine[], path: InternalPath): AffineSnap {
  const { bottomLines, bottomPoints } = getBottomLinesAndPoints({
    lines: lines.map((it) => ({
      v1: it.start,
      v2: it.end,
      onTerrain: it.onTerrain,
    })),
  })

  return {
    id: path,
    lines: bottomLines.map((line) => ({ v1: line.v1, v2: line.v2 })),
    points: bottomPoints,
    bbox: new Box3().setFromPoints(bottomPoints),
    boundingSphere: new Sphere().setFromPoints(bottomPoints),
    onTerrain: bottomLines.some((line) => line.onTerrain), // assume that if one line is on terrain for a given path, all are
  }
}
