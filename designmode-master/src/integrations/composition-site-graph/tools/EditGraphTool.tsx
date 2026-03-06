import type { Graph, Id } from "src/integrations/composition-site-graph/graph/types"
import type { Selection } from "src/integrations/composition-site-graph/state"
import { graphSelectionState } from "src/integrations/composition-site-graph/state"
import { useRecoilState } from "recoil"
import { useCallback, useEffect, useRef } from "preact/hooks"
import type { GraphMesh } from "./GraphMesh"
import { coEdgeHitMesh, updateCoEdgeHitMesh } from "./GraphMesh"
import type { SnappedPoint, SnappedSegment } from "./snapping"
import { snapGraph } from "./snapping"
import { isDefined } from "src/lib/array"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { mousePosition } from "src/core/useMousePosition"
import sceneManager from "src/core/three/sceneManager"
import { useGetPosition } from "./mousePosition"
import { addNodeCursor, defaultCursor, deleteNodeCursor } from "src/integrations/cursors/setCursor"
import type { Matrix4 } from "three"
import SelectRowhouses from "src/integrations/composition-site-graph/graph-element/CompositionSelection"
import type { GraphCapabilitiesInterface } from "src/integrations/composition-site-graph/graph-element/EditCompositionGraph"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function findSelection(position: SnappedPoint | SnappedSegment | undefined): Selection[] {
  if (position) {
    if (position.type === "point") {
      return [{ type: "vertex", id: position.point.id }]
    } else if (position.type === "segment") {
      return [{ type: "edge", id: position.segment.edgeId }]
    }
  } else {
    /**
     * TODO:
     * 1. Fetch some mouse position state
     * 2. Raycast against our own mesh using lib code built on of threejs
     */
    const intersections = mousePosition.intersectObject(coEdgeHitMesh)
    if (intersections.length > 0) {
      const i = intersections[0]
      if (isDefined(i.faceIndex)) {
        const coEdgeId = i.object.userData["edgeIdMapping"][Math.floor(i.faceIndex / 2)] as Id
        return [{ type: "co-edge", id: coEdgeId }]
      }
    } else {
      return []
    }
  }
  return []
}

function doesPointsShareEdge(state: Graph, point0: Id, point1: Id) {
  const movingPointEdges: string[] = []
  const snappedPointEdges: string[] = []
  Object.entries(state.edges).forEach(([edgeId, edge]) => {
    if (edge.start === point0 || edge.end === point0) {
      movingPointEdges.push(edgeId)
    }
    if (edge.start === point1 || edge.end === point1) {
      snappedPointEdges.push(edgeId)
    }
  })
  return movingPointEdges.some((edgeId) => snappedPointEdges.includes(edgeId))
}

function isSnappedToVertexWithOnlyOneEdge(state: Graph<any, any, any, any>, position: SnappedPoint) {
  return (
    Object.values(state.edges).filter((edge) => edge.start === position.point.id || edge.end === position.point.id)
      .length === 1
  )
}

export function EditGraphTool<O extends { graph: Graph }>({
  state,
  graphCapabilities,
  onComplete,
  onPreview,
  resetPreview,
  transform,
  onPreviewGraphVisuals,
}: {
  state: Graph
  graphCapabilities: GraphCapabilitiesInterface<O>
  onComplete: (graph: O) => void
  onPreview: (graph: O) => void
  resetPreview: () => void
  transform: Matrix4
  onPreviewGraphVisuals: GraphMesh["update"]
}) {
  const [, setSelection] = useRecoilState(graphSelectionState)
  const terrain = terrainSignal.value

  const movingPoint = useRef<string | undefined>()

  useEffect(() => {
    updateCoEdgeHitMesh(state, terrain.elevationAt)
  }, [state, terrain.elevationAt, transform])

  const getPosition = useGetPosition(state, transform)

  const update = useCallback(
    (movingPoint: string | undefined, altKey: boolean) => {
      const position = snapGraph(state, transform, terrain.elevationAt)
      if (movingPoint) {
        const snappedPosition = getPosition()
        if (!snappedPosition) return Propagate.YES

        if (position?.type === "point" && position.point.id !== movingPoint) {
          const shouldMerge = doesPointsShareEdge(state, movingPoint, position.point.id)
          const snappedToVertexWithOnlyOneEdge = isSnappedToVertexWithOnlyOneEdge(state, position)

          // snapped to a vertex that shares edge with the users moving point then we merge
          if (shouldMerge) {
            const result = graphCapabilities.removeVertex(movingPoint, state)
            onPreview(result)
            onPreviewGraphVisuals(result.graph)
          }
          //snapped to a vertex with only one edge. Then we add edge between the two vertices
          else if (snappedToVertexWithOnlyOneEdge) {
            const result = graphCapabilities.replaceVertex(state, movingPoint, position.point.id)
            onPreview(result)
            onPreviewGraphVisuals(result.graph)
          } else {
            const result = graphCapabilities.moveVertex(state, movingPoint, snappedPosition.x, snappedPosition.y)
            onPreview(result)
            onPreviewGraphVisuals(result.graph)
          }
          SelectRowhouses.setActive(false)
        } else {
          const result = graphCapabilities.moveVertex(state, movingPoint, snappedPosition.x, snappedPosition.y)
          onPreview(result)
          onPreviewGraphVisuals(result.graph)
          SelectRowhouses.setActive(false)
        }
      } else if (altKey) {
        if (position) {
          if (position.type === "segment") {
            addNodeCursor()
            const result = graphCapabilities.splitEdge(position, state)
            onPreview(result)
            const { graph } = result
            onPreviewGraphVisuals(graph)
            SelectRowhouses.setActive(false)
          } else if (position.type === "point") {
            deleteNodeCursor()
            onPreviewGraphVisuals(state, undefined, [{ type: "vertex", id: position.point.id }])
            resetPreview()
            SelectRowhouses.setActive(true)
          }
        } else {
          resetPreview()
          onPreviewGraphVisuals(state)
          SelectRowhouses.setActive(true)
          defaultCursor()
        }
      } else {
        const selection = findSelection(position)
        resetPreview()
        onPreviewGraphVisuals(state, selection)
        defaultCursor()
      }
    },
    [
      getPosition,
      graphCapabilities,
      onPreview,
      onPreviewGraphVisuals,
      resetPreview,
      state,
      terrain.elevationAt,
      transform,
    ],
  )

  const keydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        update(movingPoint.current, true)
      }
      return Propagate.YES
    },
    [update],
  )

  const keyup = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        update(movingPoint.current, false)
      }
      return Propagate.YES
    },
    [update],
  )

  const mousemove = useCallback(
    (event: MouseEvent) => {
      update(movingPoint.current, event.altKey)
      return Propagate.YES
    },
    [update],
  )

  const mouseup = useCallback(
    (event: MouseEvent) => {
      if (movingPoint.current) {
        const snappedPosition = getPosition()
        if (!snappedPosition) return Propagate.YES
        const position = snapGraph(state, transform, terrain.elevationAt)
        if (position?.type === "point" && position.point.id !== movingPoint.current) {
          const shouldMerge = doesPointsShareEdge(state, movingPoint.current, position.point.id)
          const snappedToVertexWithOnlyOneEdge = isSnappedToVertexWithOnlyOneEdge(state, position)
          if (shouldMerge) {
            graphCapabilities.removeVertex(movingPoint.current, state)
            onComplete(graphCapabilities.removeVertex(movingPoint.current, state))
          }
          //snapped to a vertex with only one edge. Then we add edge between the two vertices
          else if (snappedToVertexWithOnlyOneEdge) {
            const result = graphCapabilities.replaceVertex(state, movingPoint.current, position.point.id)
            onComplete(result)
          } else {
            onComplete(graphCapabilities.moveVertex(state, movingPoint.current, snappedPosition.x, snappedPosition.y))
          }
        } else {
          onComplete(graphCapabilities.moveVertex(state, movingPoint.current, snappedPosition.x, snappedPosition.y))
        }
      } else {
        const position = snapGraph(state, transform, terrain.elevationAt)
        if (position && event.altKey) {
          if (position.type === "segment") {
            const result = graphCapabilities.splitEdge(position, state)
            const { graph } = result
            onComplete(result)
            onPreviewGraphVisuals(graph)
          } else if (position.type === "point") {
            const result = graphCapabilities.removeVertex(position.point.id, state)
            onComplete(result)
            onPreviewGraphVisuals(result.graph)
          }
        } else {
          const selection = findSelection(position)
          setSelection(selection)
          onPreviewGraphVisuals(state, selection)
        }
      }
      movingPoint.current = undefined
      return Propagate.YES
    },
    [
      getPosition,
      state,
      transform,
      terrain.elevationAt,
      graphCapabilities,
      onComplete,
      onPreviewGraphVisuals,
      setSelection,
    ],
  )

  const mousedown = useCallback(
    (event: MouseEvent) => {
      if (event.altKey) return Propagate.YES
      const snapped = snapGraph(state, transform, terrain.elevationAt)
      if (snapped && snapped.type === "point") {
        movingPoint.current = snapped.point.id
        return Propagate.NO
      } else {
        movingPoint.current = undefined
      }
      return Propagate.YES
    },
    [state, transform, terrain.elevationAt],
  )

  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mousedown", mousedown, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("keydown", keydown, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("keyup", keyup, Priority.TOOL, sceneManager.renderer.domElement)
  return (
    <>
      {snappingAPIStateful.visualsComponent()}
      {snappingAPIStateful.snappingPicker()}
    </>
  )
}
