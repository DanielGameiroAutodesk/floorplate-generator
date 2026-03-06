import type { Object3D, Raycaster } from "three"
import { Line3, Vector3 } from "three"
import { computePointsFromCandidateLines, sortCandidateLines, sortCandidatePoints } from "./snappingEngineHelpers"
import type { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import type { GridGlobalSettings } from "./utils/lineSegmentIntersectionWithGrid"
import { filterOccluded } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/three-tools"
import { projectPositionToTerrain } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import { SNAPPING_SENSITIVITY_SQ } from "./constants"
import ArrayUtils, { minBy, uniq } from "src/lib/array"
import type { SnappingLine } from "./snapping"

import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { objectAssign } from "src/lib/record"
import type { InternalPath } from "src/lib/element/path"

export type LineSnapType =
  | "LINE"
  | "LINE_EXTENSION"
  | "PARALLEL"
  | "ORTHOGONAL"
  | "CENTER_ORTHOGONAL"
  | "ENDPOINT_RIGHT_ANGLE"
export type PointSnapType = "POINT" | "INTERSECTION" | "CENTER" | "ENDPOINT"
export type SnapType = "NOT_SNAPPED" | "GRID" | PointSnapType | LineSnapType
export type SnappingPoint = {
  position: Vector3
  type: PointSnapType
  refLines?: SnappingLine[]
  refPos?: Vector3
}

export function isSnappingLine(l: SnappingLine | SnappingPoint): l is SnappingLine {
  return ["LINE", "ENDPOINT_RIGHT_ANGLE", "LINE_EXTENSION", "ORTHOGONAL", "CENTER_ORTHOGONAL", "PARALLEL"].includes(
    l.type,
  )
}

export function isSnappingPoint(l: SnappingLine | SnappingPoint): l is SnappingPoint {
  return ["POINT", "INTERSECTION", "CENTER", "ENDPOINT"].includes(l.type)
}

export type SnapInfo = {
  position: Vector3
  orgSnappingPos: Vector3
  type: SnapType
  data: SnappingPoint | SnappingLine | undefined
  candidateLines: CandidateLine[]
}

export type CandidateLine = {
  line: SnappingLine
  distance: number
  position: Vector3
}

export function pickLineSegment(
  raycaster: Raycaster,
  raycastingTargets: Object3D[],
  linesOctree: BBoxOctree<SnappingLine>[],
  selectedContext: SnappingLine[],
  ignoredShapePaths?: Set<InternalPath>,
  filterBasedOnPosition?: (position: Vector3) => boolean,
  ignoreTerrainSnappingLines?: boolean,
): CandidateLine[] {
  const candidateLines: SnappingLine[] = linesOctree
    .flatMap((tree) => tree.getIntersectingNodes(raycaster))
    .filter((n: any) => !!n.data)
    .flatMap((octant: any) => octant.data.data)
    .filter((line: SnappingLine) => !ignoreTerrainSnappingLines || !line.onTerrain)

  let context = uniq(candidateLines.concat(selectedContext)) //Lines are added to octree once per segment, so we need to filter to get a single copy of each line

  const mapped = context
    .filter(({ shapeId }) => !ignoredShapePaths?.has(shapeId))
    .map((lin) => {
      const reusedPos = new Vector3()
      const position = new Vector3()
      let distance = Number.MAX_SAFE_INTEGER

      lin.segments.forEach((seg) => {
        const dist = raycaster.ray.distanceSqToSegment(seg.start, seg.end, undefined, reusedPos)
        if (dist < distance) {
          position.copy(reusedPos)
          distance = dist
        }
      })

      return {
        line: lin,
        distance,
        position,
      }
    })
  const inDistance = mapped
    .filter((l) => l.distance <= pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, raycaster.camera, l.position))
    .sort((a, b) => a.distance - b.distance)

  const grouped = ArrayUtils.groupBy(inDistance, (c) => c.line.type === "LINE")
  const lines = grouped.get(true) || []
  const notLines = grouped.get(false) || []
  const filtered = notLines.concat(filterOccluded(lines, raycastingTargets))
  if (!filterBasedOnPosition) return filtered

  return filtered.filter((l) => filterBasedOnPosition(l.position))
}

const PRECISION = 0.0001

export function snap(
  raycaster: Raycaster,
  raycastingTargets: Object3D[],
  lines: BBoxOctree<SnappingLine>[],
  selectedContext: SnappingLine[],
  lockedLine: SnappingLine | undefined,
  grid: GridGlobalSettings | undefined,
  terrainSampler: TerrainSamplerData,
  ignoredShapePaths?: Set<InternalPath>,
  filterBasedOnPosition?: (position: Vector3) => boolean,
  ignoreTerrainSnappingLines?: boolean,
  customSnappingPoints?: SnappingPoint[],
): SnapInfo | undefined {
  let candidateLines = pickLineSegment(
    raycaster,
    raycastingTargets,
    lines,
    selectedContext,
    ignoredShapePaths,
    filterBasedOnPosition,
    ignoreTerrainSnappingLines,
  )

  if (candidateLines.length > 0) {
    const candidatePoints: SnappingPoint[] = computePointsFromCandidateLines(
      uniq([...candidateLines.map((l) => l.line), ...(lockedLine ? [lockedLine] : []), ...selectedContext]),
      grid,
      terrainSampler,
    )

    const snappedPoints = snapPoints(raycaster, candidatePoints)
    if (snappedPoints) {
      return {
        position: snappedPoints.point.position,
        orgSnappingPos: snappedPoints.point.position,
        data: snappedPoints.point,
        type: snappedPoints.point.type,
        candidateLines,
      }
    }

    candidateLines.sort(sortCandidateLines)
    candidateLines = candidateLines
      .filter((l) => l.line.type === candidateLines[0].line.type)
      .filter((l) => Math.abs(l.distance - candidateLines[0].distance) < PRECISION)

    const posOnLine = candidateLines[0].position

    return {
      position: posOnLine,
      orgSnappingPos: posOnLine,
      type: candidateLines[0].line.type,
      data: {
        ...candidateLines[0].line,
        refLines: candidateLines.flatMap((cl) => cl.line?.refLines || []),
      },
      candidateLines,
    }
  }

  if (customSnappingPoints) {
    const snappedPoints = snapPoints(raycaster, customSnappingPoints)
    if (snappedPoints) {
      return {
        position: snappedPoints.point.position,
        orgSnappingPos: snappedPoints.point.position,
        data: snappedPoints.point,
        type: snappedPoints.point.type,
        candidateLines,
      }
    }
  }

  return undefined
}

// rename this to something more understandable
// repositions the snapped point to the closest point on the current locked line, and altering the snapinfo
// to be visualized in SnappingIndicatorInfo
const reusableLine = new Line3()

export function repositionLockedLineSnapping({
  onTerrain,
  snapped,
  lockedSnapLine,
}: {
  lockedSnapLine: SnappingLine
  onTerrain: boolean
  snapped: SnapInfo
}) {
  const newSnapInfo = snapToLockedLine(snapped, lockedSnapLine, onTerrain)
  objectAssign(snapped, newSnapInfo)
}

export function snapToLockedLine(snapInfo: SnapInfo, lockedSnapLine: SnappingLine, onTerrain: boolean): SnapInfo {
  const lockedLinePos = new Vector3()
  reusableLine
    .set(lockedSnapLine.start, lockedSnapLine.end)
    .closestPointToPoint(snapInfo.position, false, lockedLinePos)
  if (onTerrain) {
    const onTerrainPos = new Vector3()
    projectPositionToTerrain(lockedLinePos, onTerrainPos)
    const newSnapInfo = {
      ...snapInfo,
      position: onTerrainPos,
    }

    if (!snapInfo.data) {
      newSnapInfo.type = lockedSnapLine.type
      newSnapInfo.orgSnappingPos = lockedLinePos
      newSnapInfo.data = lockedSnapLine
    }
    return newSnapInfo
  }
  return {
    ...snapInfo,
    position: lockedLinePos,
  }
}

export type SnappedPoint = {
  distanceSq: number
  point: SnappingPoint
}
const NUMERICAL_PRECISION = 0.00001
export const snapPoints = (raycaster: Raycaster, points: SnappingPoint[]): SnappedPoint | undefined => {
  const { ray, camera } = raycaster
  const pointsWithDistances = points.map((point) => ({
    point: point,
    distanceSq: ray.distanceSqToPoint(point.position),
  }))
  if (pointsWithDistances.length === 0) return undefined
  pointsWithDistances.sort(sortCandidatePoints)
  const closestToPoint = pointsWithDistances[0]
  const candidates = pointsWithDistances
    .filter((x) => closestToPoint.distanceSq + NUMERICAL_PRECISION > x.distanceSq)
    .map((x) => ({ ...x, distanceToCamera: ray.origin.distanceTo(x.point.position) }))
  const closestCandidateToCamera = minBy(candidates, (dist) => dist.distanceToCamera)
  if (
    closestCandidateToCamera &&
    closestCandidateToCamera.distanceSq <=
      pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, camera, closestCandidateToCamera.point.position)
  ) {
    return {
      distanceSq: closestCandidateToCamera.distanceSq,
      point: closestCandidateToCamera.point,
    }
  }
  return undefined
}
