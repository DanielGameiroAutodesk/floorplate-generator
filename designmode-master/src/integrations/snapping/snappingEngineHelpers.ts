import type { Object3D, Raycaster } from "three"
import { Box3, Line3, Ray, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import type { CandidateLine, LineSnapType, PointSnapType, SnappedPoint, SnappingPoint } from "./snappingEngine"
import ArrayUtils, { uniq } from "src/lib/array"
import { subdivideLine } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import { v4 as uuid } from "uuid"
import type { GridGlobalSettings } from "./utils/lineSegmentIntersectionWithGrid"
import lineSegmentIntersectionsWithGrid from "./utils/lineSegmentIntersectionWithGrid"
import parametricLineIntersection from "./utils/parametricLineIntersection"
import { SNAPPING_SENSITIVITY } from "./constants"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import type { Segment3, SnappingLine } from "./snapping"
import { samePoint } from "src/lib/three/geometryUtils"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { raycast } from "src/core/terrain/2d-raytracer"

export function intersectScene(pos: Raycaster, targets: Object3D[]) {
  const terrain = sceneManager.scene.getObjectByName("Terrain")
  if (!terrain) return
  const intersections = pos.intersectObjects([...targets, terrain])
  if (intersections.length === 0) return undefined

  return intersections[0].point
}

export function snappingLineFromEndpoints(
  start: Vector3,
  end: Vector3,
  type: LineSnapType,
  onTerrain = false,
  terrainSamplerData: TerrainSamplerData | undefined,
  shapeId?: string,
  refLines?: SnappingLine[],
): SnappingLine {
  let segments: Segment3[] = []

  const projectToTerrain = (v: Vector3) => {
    if (!terrainSamplerData) throw new Error("Cannot place vertices on terrain without a terrain. No terrain given.")
    return project(terrainSamplerData, v)
  }

  if (onTerrain) {
    ArrayUtils.sliding2(subdivideLine([start, end], 2).map(projectToTerrain)).forEach(([segStart, segEnd]) =>
      segments.push({
        start: segStart,
        end: segEnd,
        bbox: bboxFromEndpoints(segStart, segEnd, SNAPPING_SENSITIVITY),
      }),
    )
  } else {
    segments.push({
      start: start,
      end: end,
      bbox: bboxFromEndpoints(start, end, pixelsToMetersAtPosition(SNAPPING_SENSITIVITY, sceneManager.camera, start)),
    })
  }
  return {
    type,
    shapeId: shapeId || uuid(),
    start: onTerrain ? projectToTerrain(start) : start,
    end: onTerrain ? projectToTerrain(end) : end,
    center: onTerrain ? projectToTerrain(centerOfLine(start, end)) : centerOfLine(start, end),
    segments,
    onTerrain,
    refLines,
  }
}

function project(terrain: TerrainSamplerData, v: Vector3, target = new Vector3()): Vector3 {
  const sampleZ = raycast(v.x, v.y, terrain)
  return target.set(v.x, v.y, sampleZ)
}

export function bboxFromEndpoints(end1: Vector3, end2: Vector3, buffer = 0): Box3 {
  return new Box3().expandByPoint(end1).expandByPoint(end2).expandByScalar(buffer)
}

const reusableVector3 = new Vector3()
const UPVector = new Vector3(0, 0, 1)

export function computePointsFromCandidateLines(
  inputLines: SnappingLine[],
  grid: GridGlobalSettings | undefined,
  terrainSampler: TerrainSamplerData,
): SnappingPoint[] {
  const lines = uniq(inputLines)
  const pointsOnLines = lines.flatMap((l) => {
    if (l.type !== "LINE") return []
    return [
      {
        position: l.onTerrain ? project(terrainSampler, l.start) : l.start,
        type: "ENDPOINT",
        refLines: [l],
      },
      {
        position: l.onTerrain ? project(terrainSampler, l.end) : l.end,
        type: "ENDPOINT",
        refLines: [l],
      },
      {
        position: l.onTerrain ? project(terrainSampler, l.center) : l.center,
        type: "CENTER",
        refLines: [l],
      },
    ] as SnappingPoint[]
  })

  const reusableLine = new Line3()
  const reusableOtherLine = new Line3()

  const gridIntersections: SnappingPoint[] = lines
    .flatMap((l) => {
      return lineSegmentIntersectionsWithGrid(grid, l.start, l.end)
    })
    .map((v) => ({
      position: v,
      type: "INTERSECTION",
    }))

  const intersections: SnappingPoint[] = lines.flatMap((line) =>
    lines.flatMap((otherLine) => {
      if (line === otherLine) return []
      const xyPlaneIntersection = parametricLineIntersection(
        reusableLine.set(line.start, line.end),
        reusableOtherLine.set(otherLine.start, otherLine.end),
      )
      if (!xyPlaneIntersection) return []

      if (
        samePoint(line.start, otherLine.start) ||
        samePoint(line.start, otherLine.end) ||
        samePoint(line.end, otherLine.end) ||
        samePoint(line.end, otherLine.end)
      ) {
        return []
      }

      const { x, y } = xyPlaneIntersection
      reusableVector3.set(x, y, -2000)
      const ray = new Ray(reusableVector3, UPVector)

      const onLine = new Vector3()
      const lineDist = ray.distanceSqToSegment(line.end, line.start, undefined, onLine)
      const onOtherLine = new Vector3()
      const otherLineDist = ray.distanceSqToSegment(otherLine.end, otherLine.start, undefined, onOtherLine)

      if (otherLineDist + lineDist > 0.0001) {
        return []
      }
      let intersectionPoints: SnappingPoint[] = []

      let lineEndpoints = [line.start, line.end, otherLine.start, otherLine.end]

      if (lineEndpoints.filter((p) => samePoint(p, onLine)).length === 0) {
        intersectionPoints.push({
          type: "INTERSECTION",
          position: line.onTerrain ? project(terrainSampler, onLine) : onLine,
          refLines: [line, otherLine],
          refPos: otherLine.onTerrain ? project(terrainSampler, onOtherLine) : onOtherLine,
        })
      }
      if (lineEndpoints.filter((p) => samePoint(p, onOtherLine)).length === 0) {
        intersectionPoints.push({
          type: "INTERSECTION",
          position: otherLine.onTerrain ? project(terrainSampler, onOtherLine) : onOtherLine,
          refLines: [line, otherLine],
          refPos: line.onTerrain ? project(terrainSampler, onLine) : onLine,
        })
      }
      return intersectionPoints
    }),
  )

  return pointsOnLines.concat(intersections).concat(gridIntersections)
}

const reusableLine = new Line3()

export function centerOfLine(start: Vector3, end: Vector3): Vector3 {
  reusableLine.set(start, end)
  return reusableLine.getCenter(new Vector3())
}

const lineSortOrder: LineSnapType[] = [
  "LINE",
  "LINE_EXTENSION",
  "CENTER_ORTHOGONAL",
  "PARALLEL",
  "ORTHOGONAL",
  "ENDPOINT_RIGHT_ANGLE",
]

export function sortCandidateLines(a: CandidateLine, b: CandidateLine) {
  const aValue = lineSortOrder.indexOf(a.line.type) || 0
  const bValue = lineSortOrder.indexOf(b.line.type) || 0

  if (aValue < bValue) return -1
  if (aValue > bValue) return 1
  return 0
}

const pointSortOrder: PointSnapType[] = ["ENDPOINT", "POINT", "CENTER", "INTERSECTION"]
export function sortCandidatePoints(a: SnappedPoint, b: SnappedPoint) {
  return a.distanceSq - b.distanceSq
}

export function sortCandidatePointsByType(a: SnappedPoint, b: SnappedPoint) {
  const aTypeOrder = pointSortOrder.indexOf(a.point.type) || 0
  const bTypeOrder = pointSortOrder.indexOf(b.point.type) || 0

  if (aTypeOrder < bTypeOrder) return -1
  if (aTypeOrder > bTypeOrder) return 1
  return 0
}
