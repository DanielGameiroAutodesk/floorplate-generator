import type { Graph, Id } from "src/integrations/composition-site-graph/graph/types"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { useCallback } from "preact/hooks"
import { snapGraph } from "./snapping"
import { mousePosition } from "src/core/useMousePosition"
import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { getGlobalTerrainPosition } from "./getGlobalTerrainPosition"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type SnappedPosition = { type: "snappedToGraph" | "snappedToContext" | "unsnapped"; x: number; y: number }

/**
 * Returns local point
 * */
export function useGetPosition(
  state: Graph,
  transform: Matrix4,
  lastPlacedVertexId?: Id,
): () => SnappedPosition | undefined {
  const terrain = terrainSignal.value

  const snapToContext = useCallback(
    (lastPlacedVertexId: string | undefined) => {
      const lastPlacedVertex = lastPlacedVertexId ? state._vertices[lastPlacedVertexId] : undefined

      const globalPosition = lastPlacedVertex
        ? getGlobalTerrainPosition(lastPlacedVertex, transform, terrain.elevationAt)
        : undefined

      return snappingAPIStateful.snap(
        //TODO: Move mousePosition inside API
        mousePosition,
        globalPosition,
        Object.values(state._edges).map((edge) => {
          const edgeStart = getGlobalTerrainPosition(state._vertices[edge.start], transform, terrain.elevationAt)
          const edgeEnd = getGlobalTerrainPosition(state._vertices[edge.end], transform, terrain.elevationAt)
          return snappingAPIStateful.createSnappingLineFromLine(edgeStart, edgeEnd)
        }),
      )
    },
    [state._edges, state._vertices, terrain.elevationAt, transform],
  )

  return useCallback((): SnappedPosition | undefined => {
    const snappedToGraph = snapGraph(state, transform, terrain.elevationAt)
    const snapInfo = snapToContext(lastPlacedVertexId)
    if (snapInfo) {
      snappingAPIStateful.setSnapInfo(snapInfo)
    }

    if (snappedToGraph) {
      if (snappedToGraph.type === "point") {
        return {
          x: snappedToGraph.point.position.x,
          y: snappedToGraph.point.position.y,
          type: "snappedToGraph",
        }
      } else if (snappedToGraph.type === "segment") {
        return {
          x: snappedToGraph.point.x,
          y: snappedToGraph.point.y,
          type: "snappedToGraph",
        }
      }
    }

    const matrix4Inverse = transform.clone().invert()

    if (snapInfo) {
      const vec = new Vector3(snapInfo.position.x, snapInfo.position.y).applyMatrix4(matrix4Inverse)
      return {
        x: vec.x,
        y: vec.y,
        type: "snappedToContext",
      }
    }

    const result = raycastApi.raycastTerrain()
    if (result) {
      const vec = new Vector3(result.position.x, result.position.y, 0).applyMatrix4(matrix4Inverse)
      return { x: vec.x, y: vec.y, type: "unsnapped" }
    }
    return undefined
  }, [state, transform, terrain.elevationAt, snapToContext, lastPlacedVertexId])
}
