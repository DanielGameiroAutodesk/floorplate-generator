import { useCallback, useMemo } from "preact/hooks"
import type { Triangle } from "three"
import { Box2, Box3, Vector2, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import { SNAPPING_DISTANCE } from "./Affine"
import { doEdgesIntersect, pixelsToMetersAtPosition } from "./utils"
import { elementState } from "src/core/elements/ElementState"
import { HiddenPaths, scenarioHiddenSignal } from "src/core/hidden"
import type { CategoryState } from "src/core/categories"
import { categoryStateSignal } from "src/core/categories"
import type { InternalPath } from "src/lib/element/path"
import { NODE_PREDICATES } from "src/core/elements/predicates"
import { previewSetSignal } from "src/core/preview-element-state"
import type { Proposal } from "src/core/elements/Proposal"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"

const errorMargin = 0.01

// checks if point is within triangle, returning false if point is on edge
// as opposed to Triangle.containsPoint which would return true in that case
const bary = new Vector3()

function isPointWithinTriangle(point: Vector3, tri: Triangle) {
  tri.getBarycoord(point.clone().setZ(tri.a.z), bary)
  return bary.x > errorMargin && bary.y > errorMargin && bary.x + bary.y < 1 - errorMargin
}

function roofAndFloorTrianglesNewElementState(
  movingIds: Set<string>,
  proposal: Proposal,
  terrain: NewTerrainState,
  scenarioHidden: boolean,
  categoryState: CategoryState,
  hiddenPaths: Set<InternalPath>,
  previewFilter: Set<InternalPath>,
) {
  if (!movingIds.size)
    return [...proposal.snapshot.nodes.values()].flatMap((node) => node.roofAndFloorTriangles.getOrCompute())
  const nonHiddenNodes = [...proposal.snapshot.nodes.values()].filter(
    NODE_PREDICATES.allOf(
      NODE_PREDICATES.isInVisibleCategory(categoryState),
      NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHidden),
      NODE_PREDICATES.isNotHiddenByPreview(previewFilter),
      NODE_PREDICATES.isNotTempHidden(hiddenPaths),
    ),
  )
  const movingBbox = new Box3()
  for (const movingId of movingIds) {
    const movingNode = proposal.snapshot.getNode(movingId)
    const affineSnapBbox = movingNode?.affineSnapInfo(terrain.terrainSamplerData).getOrCompute().bbox
    affineSnapBbox && movingBbox.union(affineSnapBbox)
  }
  return nonHiddenNodes
    .filter((node) => {
      const boundingSphere = node.affineSnapInfo(terrain.terrainSamplerData).getOrCompute().boundingSphere
      return movingBbox.distanceToPoint(boundingSphere.center) <= boundingSphere.radius + SNAPPING_DISTANCE
    })
    .flatMap((node) => node.roofAndFloorTriangles.getOrCompute())
}

export function useRoofAndFloorSnapping(movingIds: Set<string>) {
  const scenarioHidden = scenarioHiddenSignal.value
  const categoryState = categoryStateSignal.value
  const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
  const previewFilter = previewSetSignal.value
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  const roofAndFloorTriangles = useMemo(
    () =>
      roofAndFloorTrianglesNewElementState(
        movingIds,
        proposal,
        terrain,
        scenarioHidden,
        categoryState,
        hiddenPaths,
        previewFilter,
      ),
    [categoryState, movingIds, previewFilter, scenarioHidden, proposal, hiddenPaths, terrain],
  )

  const snapPointToRoofsAndFloors = useCallback(
    (position: Vector3, includeEdges: boolean) => {
      const vec3 = new Vector3()
      return roofAndFloorTriangles.filter((tri) => {
        vec3.set(position.x, position.y, tri.a.z)
        return includeEdges ? tri.containsPoint(vec3) : isPointWithinTriangle(vec3, tri)
      })
    },
    [roofAndFloorTriangles],
  )

  const snapEdgeToRoofAndFloorTriangles = useCallback(
    (edge: [Vector3, Vector3]) => {
      const triangleBBox = new Box2()
      const edgeBBox = new Box2().setFromPoints([new Vector2(edge[0].x, edge[0].y), new Vector2(edge[1].x, edge[1].y)])
      return roofAndFloorTriangles.filter((triangle) => {
        triangleBBox.setFromPoints([
          new Vector2(triangle.a.x, triangle.a.y),
          new Vector2(triangle.b.x, triangle.b.y),
          new Vector2(triangle.c.x, triangle.c.y),
        ])
        if (!triangleBBox.intersectsBox(edgeBBox)) return false

        for (let [a, b] of [
          [triangle.a, triangle.b],
          [triangle.b, triangle.c],
          [triangle.c, triangle.a],
        ]) {
          const intersection = doEdgesIntersect(edge[0].x, edge[0].y, edge[1].x, edge[1].y, a.x, a.y, b.x, b.y)
          if (intersection) return true
        }
        return false
      })
    },
    [roofAndFloorTriangles],
  )

  const snapLinesToRoofsAndFloors = useCallback(
    (lines: [Vector3, Vector3][], targetElevation: number, includeEdges = true) => {
      let snappedTriangles: Triangle[] = []
      for (let line of lines) {
        const point = line[0]
        const candidateTriangles = [
          ...snapPointToRoofsAndFloors(point, includeEdges),
          ...snapEdgeToRoofAndFloorTriangles(line),
        ]
        snappedTriangles.push(...candidateTriangles)
        if (snappedTriangles.length) {
          for (let triangle of snappedTriangles) {
            const point = line[0]
            const minDiff = pixelsToMetersAtPosition(SNAPPING_DISTANCE, sceneManager.camera, point)
            const zDiff = Math.abs(triangle.a.z - targetElevation)
            if (zDiff < minDiff) {
              return triangle.a.z
            }
          }
        }
      }
    },
    [snapEdgeToRoofAndFloorTriangles, snapPointToRoofsAndFloors],
  )

  return {
    snapLinesToRoofsAndFloors,
    snapPointToRoofsAndFloors,
  }
}
