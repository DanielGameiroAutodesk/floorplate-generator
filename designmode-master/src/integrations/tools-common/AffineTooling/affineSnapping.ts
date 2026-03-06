import { Group, Vector2, Vector3 } from "three"

import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import {
  ACTIVE_SNAPPING_LINE_MATERIAL,
  DASHED_SNAPPING_LINE_MATERIAL,
} from "src/integrations/tools-common/Drawing/shapeTool/visuals/snappingLineMaterials"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import { ThreePolygonLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreePolygonLine"
import { ThreeShape } from "src/integrations/tools-common/Drawing/shapeTool/visuals/ThreeShape"
import { useCallback } from "preact/hooks"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import type { AffineSnap } from "src/integrations/snapping/snapping"
import { raycast } from "src/core/terrain/2d-raytracer"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const _startP = /*@__PURE__*/ new Vector3()
const _startEnd = /*@__PURE__*/ new Vector3()
export function vectorLineToPoint(l1: Vector3, l2: Vector3, point: Vector3, _target?: Vector3) {
  const target = _target || new Vector3()
  _startP.subVectors(point, l1)
  _startEnd.subVectors(l2, l1)

  const startEnd2 = _startEnd.dot(_startEnd)
  const startEnd_startP = _startEnd.dot(_startP)

  let t = startEnd_startP / startEnd2
  const clamped = Math.max(0, Math.min(1, t))
  const closestPointOnLine = target.subVectors(l2, l1).multiplyScalar(clamped).add(l1)
  return closestPointOnLine.sub(point)
}

export function affineSnap(
  movingSnapLines: AffineSnap[],
  targetSnapLines: AffineSnap[],
  moveVec: Vector3,
  snappingDist: number = 0.1,
) {
  const movedBoxes = movingSnapLines.map((m) => {
    return m.bbox.clone().translate(moveVec)
  })
  const closeTargets = targetSnapLines.filter((t) => {
    return movedBoxes.some(
      (b) =>
        b.distanceToPoint(new Vector3(t.boundingSphere.center.x, t.boundingSphere.center.y, b.min.z)) <=
        t.boundingSphere.radius + snappingDist,
    )
  })
  if (closeTargets.length === 0) return { translation: moveVec, snapped: false }

  const movedLines = movingSnapLines.map((m) => {
    return {
      ...m,
      lines: m.lines.map(({ v1, v2 }) => [v1.clone().add(moveVec), v2.clone().add(moveVec)]),
    }
  })

  let bestMatch: {
    snapVec: Vector3
    id?: string
    snapData?: SnapData
  } = { snapVec: new Vector3(snappingDist, snappingDist, snappingDist) }
  const snapVec = new Vector3()
  for (const closeTarget of closeTargets) {
    for (const targetLine of closeTarget.lines) {
      for (const movingSnapLine of movedLines) {
        for (const movingLine of movingSnapLine.lines) {
          for (const t of [targetLine.v1, targetLine.v2]) {
            for (const p of movingLine) {
              if (snapVec.subVectors(t, p).setZ(0).length() < bestMatch.snapVec.length()) {
                bestMatch.snapVec.copy(snapVec)
                bestMatch.id = closeTarget.id
                bestMatch.snapData = {
                  target: {
                    shape: [t],
                    onTerrain: !!closeTarget.onTerrain,
                  },
                  selection: {
                    shape: [p.clone().add(bestMatch.snapVec)],
                    onTerrain: !!movingSnapLine.onTerrain,
                  },
                }
              }
            }
          }
        }
      }
    }
  }

  const pointSnap = new Vector2(bestMatch.snapVec.x, bestMatch.snapVec.y).length() <= snappingDist
  if (!pointSnap) {
    for (const closeTarget of closeTargets) {
      for (const target of closeTarget.lines) {
        const { v1: p1, v2: p2 } = target
        for (const movedLine of movedLines) {
          for (const moved of movedLine.lines) {
            const [p3, p4] = moved
            vectorLineToPoint(p1, p2, p3, snapVec).setZ(0)
            if (snapVec.length() < bestMatch.snapVec.length()) {
              bestMatch.id = closeTarget.id
              bestMatch.snapVec.copy(snapVec)
              bestMatch.snapData = {
                target: {
                  shape: Object.values(target),
                  onTerrain: !!closeTarget.onTerrain,
                },
                selection: {
                  shape: [p3.clone().add(snapVec)],
                  onTerrain: !!movedLine.onTerrain,
                },
              }
            }
            vectorLineToPoint(p1, p2, p4, snapVec).setZ(0)
            if (snapVec.length() < bestMatch.snapVec.length()) {
              bestMatch.id = closeTarget.id
              bestMatch.snapVec.copy(snapVec)
              bestMatch.snapData = {
                target: {
                  shape: Object.values(target),
                  onTerrain: !!closeTarget.onTerrain,
                },
                selection: {
                  shape: [p4.clone().add(snapVec)],
                  onTerrain: !!movedLine.onTerrain,
                },
              }
            }
            vectorLineToPoint(p3, p4, p1, snapVec).setZ(0)
            if (snapVec.length() < bestMatch.snapVec.length()) {
              bestMatch.id = closeTarget.id
              bestMatch.snapVec.copy(snapVec).multiplyScalar(-1)
              bestMatch.snapData = {
                target: {
                  shape: [p1],
                  onTerrain: !!closeTarget.onTerrain,
                },
                selection: {
                  shape: moved.map((p) => p.clone().add(bestMatch.snapVec)),
                  onTerrain: !!movedLine.onTerrain,
                },
              }
            }
            vectorLineToPoint(p3, p4, p2, snapVec).setZ(0)
            if (snapVec.length() < bestMatch.snapVec.length()) {
              bestMatch.id = closeTarget.id
              bestMatch.snapVec.copy(snapVec).multiplyScalar(-1)
              bestMatch.snapData = {
                target: {
                  shape: [p2],
                  onTerrain: !!closeTarget.onTerrain,
                },
                selection: {
                  shape: moved.map((p) => p.clone().add(bestMatch.snapVec)),
                  onTerrain: !!movedLine.onTerrain,
                },
              }
            }
          }
        }
      }
    }
  }
  const isSnapped = bestMatch && new Vector2(bestMatch.snapVec.x, bestMatch.snapVec.y).length() <= snappingDist
  const snapped = isSnapped ? bestMatch.snapVec.add(moveVec) : moveVec
  return { translation: snapped, snapped: isSnapped, snapData: bestMatch.snapData }
}

const getSnappingVisual = (
  lineOrPoint: { shape: Vector3[]; onTerrain?: boolean },
  terrainSamplerData?: TerrainSamplerData,
) => {
  if (lineOrPoint.shape.length === 1) {
    // point
    const point = lineOrPoint.shape[0].clone()
    if (lineOrPoint.onTerrain && terrainSamplerData) {
      point.setZ(raycast(point.x, point.y, terrainSamplerData))
    }
    const handle = new VertexHandle(point)
    handle.snapActive()
    return handle
  } else {
    // line
    if (lineOrPoint.onTerrain && terrainSamplerData) {
      const shape = {
        vertices: lineOrPoint.shape,
        edges: [[0, 1] as [number, number]],
        faces: [],
        loops: [],
      }
      return new ThreeShape(shape, ACTIVE_SNAPPING_LINE_MATERIAL, true, terrainSamplerData)
    } else {
      const geo = new LineSegmentsGeometry()
      geo.setPositions(lineOrPoint.shape.flatMap((p) => p.toArray()))
      const mesh = new LineSegments2(geo, ACTIVE_SNAPPING_LINE_MATERIAL)
      return mesh
    }
  }
}

export type SnapData = {
  target: {
    shape: Vector3[]
    onTerrain: boolean
  }
  selection: {
    shape: Vector3[]
    onTerrain: boolean
  }
}

export function getSnappingGroup(snapData: SnapData, terrainSamplerData: TerrainSamplerData) {
  const group = new Group()
  group.name = "Snapping Group"
  const target = getSnappingVisual(snapData.target, terrainSamplerData)
  group.add(target)
  const selection = getSnappingVisual(snapData.selection, terrainSamplerData)
  group.add(selection)
  if (snapData.target.shape.length === 1) {
    const targetPoint = snapData.target.shape[0].clone()
    if (snapData.target.onTerrain) targetPoint.setZ(raycast(targetPoint.x, targetPoint.y, terrainSamplerData))

    const selectionPoint = snapData.selection.shape[0].clone()
    if (snapData.selection.onTerrain) selectionPoint.setZ(raycast(targetPoint.x, targetPoint.y, terrainSamplerData))

    const dashed = new ThreePolygonLine(
      [targetPoint, targetPoint.clone().setZ(selectionPoint.z)],
      false,
      DASHED_SNAPPING_LINE_MATERIAL,
    )
    group.add(dashed)
  }
  if (snapData.selection.shape.length === 1) {
    const selectionPoint = snapData.selection.shape[0].clone()
    if (snapData.selection.onTerrain)
      selectionPoint.setZ(raycast(selectionPoint.x, selectionPoint.y, terrainSamplerData))

    const targetPoint = snapData.target.shape[0].clone()
    if (snapData.target.onTerrain) targetPoint.setZ(raycast(selectionPoint.x, selectionPoint.y, terrainSamplerData))

    const dashed = new ThreePolygonLine(
      [selectionPoint, selectionPoint.clone().setZ(targetPoint.z)],
      false,
      DASHED_SNAPPING_LINE_MATERIAL,
    )
    group.add(dashed)
  }
  return group
}

export const useGetSnappingGroup = () => {
  const terrainSamplerData = terrainSignal.value.terrainSamplerData

  return useCallback(
    (snapData: SnapData) => {
      return getSnappingGroup(snapData, terrainSamplerData)
    },
    [terrainSamplerData],
  )
}
