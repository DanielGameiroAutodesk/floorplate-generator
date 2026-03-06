import { useCallback, useEffect, useMemo, useState } from "preact/hooks"

import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"

import { addNodeCursor, defaultCursor, drawCursor, moveCursor } from "src/integrations/cursors/setCursor"

/* eslint-disable import/no-internal-modules */
import { dragVertex } from "./fpsCode/draggingVertex"
import { dragWall } from "./fpsCode/draggingWall"
import { getUpdatedSelectedEdgesIDs } from "./fpsCode/utils"
import type { HoveredItem } from "./selection"
import { getHoveredItem, getMousePoint, snappingDistanceAtPosition } from "./selection"
import { removeEdges, removeVertex } from "./fpsCode/remove"
import { getDrawLineEndPoint } from "./fpsCode/drawLineEndPoint"
import { addNewEdge, addNewPoint, addPointToExistingEdge } from "./fpsCode/addLineOrPoint"
import { ExploreGraphVisuals, SnappingGuidelineVisuals } from "./visuals"
import { snapPointToWalls } from "./fpsCode/snapping"
import { getLinesFromGraph } from "./fpsCode/utils/graphUtils"
/* eslint-enable import/no-internal-modules */

const SNAPPING_FACTOR = 3

type Vertex = { x: number; y: number; id: string }
type Edge = { start: string; end: string; id: string }
type Vertices = { [id: string]: Vertex }
type Edges = { [id: string]: Edge }
export type SimpleGraph = {
  vertices: Vertices
  edges: Edges
}

type Point = { x: number; y: number }
type GuideLine = { type: string; line: [Point, Point] }

type SnappedPoint =
  | undefined
  | { point: Point; type: "snappedToVertex" }
  | { point: Point; type: "snappedToWall"; wall: any; guideLines?: GuideLine[] }
  | { point: Point; type: "snappedToGuideLine"; guideLines: GuideLine[] }

type InternalToolState =
  | { state: "idle"; hovered?: HoveredItem }
  | { state: "selectedVertex"; hovered?: HoveredItem; selectedVertexID: string }
  | { state: "selectedEdges"; hovered?: HoveredItem; selectedEdgeIDs: string[] }
  | { state: "mousedownVertex"; hovered?: HoveredItem; startPoint: Point; vertexID: string }
  | { state: "mousedownEdge"; hovered?: HoveredItem; startPoint: Point; edgeID: string; selectedEdgeIDs: string[] }
  | { state: "draggingVertex"; preview: SimpleGraph; startPoint: Point; currentPoint?: SnappedPoint; vertexID: string }
  | { state: "draggingEdge"; preview: SimpleGraph; startPoint: Point; edgeID: string }
  | { state: "drawLine"; preview: SimpleGraph; startPoint?: Point; currentPoint?: SnappedPoint }
  | { state: "addNode"; preview: SimpleGraph; snappedPoint?: Point; isEnabledByAltKey?: true }

export type ExploreGraphEditorState = "idle" | "drawLine" | "editing" | "addNode"

export function ExploreGraphEditor({
  graph,
  onGraphChange,
  editorState,
  onEditorStateChange,
  onGraphPreviewChange,
}: {
  graph: SimpleGraph
  onGraphChange: (graph: SimpleGraph) => void
  editorState?: ExploreGraphEditorState
  onEditorStateChange: (toolState: ExploreGraphEditorState) => void
  onGraphPreviewChange?: (graph: SimpleGraph) => void
}) {
  const [snappingRules] = useState({ object: true, guidelines: true })
  const [toolState, setToolState] = useState<InternalToolState>(() => {
    if (!editorState) return { state: "idle" }
    if (editorState === "editing") return { state: "idle" } // not supported to set the state to "editing" directly
    if (editorState === "drawLine") return { state: "drawLine", preview: graph }
    if (editorState === "addNode") return { state: "addNode", preview: graph }
    return { state: editorState }
  })

  useEffect(() => {
    // Update the "internal" tool state when the editor state changes
    setToolState((currValue) => {
      if (!editorState) return currValue
      if (currValue.state === editorState) return currValue
      if (editorState === "editing") return currValue // not supported to set the state to "editing" directly
      if (editorState === "drawLine") return { state: "drawLine", preview: graph }
      if (editorState === "addNode") return { state: "addNode", preview: graph }
      return { state: editorState }
    })
  }, [editorState, setToolState, graph])

  const mousedown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.YES
      const mousePoint = getMousePoint()
      if (!mousePoint) return Propagate.YES

      let propagate: Propagate = Propagate.YES

      setToolState((currValue) => {
        if (currValue.state == "idle" || currValue.state == "selectedVertex" || currValue.state == "selectedEdges") {
          const hovered = currValue.hovered
          if (hovered?.type == "vertex") {
            propagate = Propagate.NO
            const startPoint = mousePoint
            const vertexID = hovered.id
            onEditorStateChange("editing")
            return { state: "mousedownVertex", hovered, startPoint, vertexID }
          } else if (hovered?.type == "edge") {
            propagate = Propagate.NO
            const startPoint = mousePoint
            const edgeID = hovered.id
            const selectedEdgeIDs = currValue.state == "selectedEdges" ? currValue.selectedEdgeIDs : []
            onEditorStateChange("editing")
            return { state: "mousedownEdge", hovered, startPoint, edgeID, selectedEdgeIDs }
          }
        }
        return currValue
      })

      return propagate
    },
    [onEditorStateChange],
  )

  const mousemove = useCallback(
    (e: MouseEvent) => {
      const mousePoint = getMousePoint()
      if (!mousePoint) return Propagate.YES
      const snappingDist = e.altKey ? 0 : snappingDistanceAtPosition(mousePoint) * SNAPPING_FACTOR

      let propagate = Propagate.YES

      setToolState((currValue) => {
        if (currValue.state == "addNode") {
          propagate = Propagate.NO
          const snappedPoint = snapPointToWalls(
            mousePoint,
            getLinesFromGraph(graph),
            snappingDistanceAtPosition(mousePoint) * SNAPPING_FACTOR, // enforce snapping
          )
          if (!snappedPoint) {
            return { ...currValue, preview: graph, snappedPoint: undefined }
          }
          const preview = addPointToExistingEdge(graph, snappedPoint) as SimpleGraph
          return { ...currValue, preview, snappedPoint: snappedPoint.point }
        }
        if (currValue.state == "idle" || currValue.state == "selectedVertex" || currValue.state == "selectedEdges") {
          const hovered = getHoveredItem(graph)
          if (currValue.hovered?.type == hovered?.type && currValue.hovered?.id == hovered?.id) return currValue
          return { ...currValue, hovered }
        }
        if (currValue.state == "mousedownVertex" || currValue.state == "draggingVertex") {
          propagate = Propagate.NO
          const { vertexID, startPoint } = currValue
          const { wallGraph: preview, snappingData: currentPoint } = dragVertex(
            graph,
            vertexID,
            startPoint,
            mousePoint,
            snappingDist,
            snappingRules,
          ) as { wallGraph: SimpleGraph; snappingData: SnappedPoint }
          onEditorStateChange("editing")
          if (onGraphPreviewChange) onGraphPreviewChange(preview)
          return { ...currValue, state: "draggingVertex", preview, currentPoint }
        }
        if (currValue.state == "mousedownEdge" || currValue.state == "draggingEdge") {
          propagate = Propagate.NO
          const { edgeID, startPoint } = currValue
          const { wallGraph: preview } = dragWall(graph, edgeID, startPoint, mousePoint, snappingDist, snappingRules)
          onEditorStateChange("editing")
          if (onGraphPreviewChange) onGraphPreviewChange(preview)
          return { ...currValue, state: "draggingEdge", preview }
        }
        if (currValue.state == "drawLine") {
          propagate = Propagate.NO
          const { startPoint } = currValue
          const currentPoint = getDrawLineEndPoint(
            mousePoint,
            startPoint,
            graph,
            snappingDist,
            snappingRules,
          ) as SnappedPoint
          if (!currentPoint) return currValue

          const preview = (() => {
            if (startPoint) {
              return addNewEdge(graph, startPoint, currentPoint.point) as SimpleGraph
            }
            if (snappingRules.object) {
              if (currentPoint.type === "snappedToWall") {
                return addPointToExistingEdge(graph, currentPoint) as SimpleGraph
              }
              if (currentPoint.type === "snappedToGuideLine") {
                return addNewPoint(graph, currentPoint.point) as SimpleGraph
              }
            }
            return graph
          })()

          if (onGraphPreviewChange) onGraphPreviewChange(preview)
          return { ...currValue, preview, currentPoint }
        }
        return currValue
      })

      return propagate
    },
    [graph, snappingRules, onEditorStateChange, onGraphPreviewChange],
  )

  const mouseup = useCallback(
    (e: MouseEvent) => {
      let propagate = Propagate.YES
      setToolState((currValue) => {
        if (currValue.state == "mousedownVertex") {
          onEditorStateChange("editing")
          return { state: "selectedVertex", selectedVertexID: currValue.vertexID }
        }
        if (currValue.state == "draggingVertex") {
          onGraphChange(currValue.preview)
          onEditorStateChange("idle")
          propagate = Propagate.NO
          return { state: "idle" }
        }
        if (currValue.state == "mousedownEdge") {
          const selectedEdgeIDs = getUpdatedSelectedEdgesIDs(currValue.selectedEdgeIDs, currValue.edgeID, e.shiftKey)
          onEditorStateChange("editing")
          return { state: "selectedEdges", selectedEdgeIDs }
        }
        if (currValue.state == "draggingEdge") {
          onGraphChange(currValue.preview)
          onEditorStateChange("idle")
          propagate = Propagate.NO
          return { state: "idle" }
        }
        if (currValue.state == "drawLine") {
          const { startPoint, currentPoint } = currValue
          if (!currentPoint) return currValue
          onGraphChange(currValue.preview)

          const currentlySnappedToGraph =
            currentPoint?.type === "snappedToWall" || currentPoint?.type === "snappedToVertex"
          const endDrawingNow = startPoint && currentlySnappedToGraph
          if (endDrawingNow) {
            return { state: "drawLine", preview: currValue.preview }
          } else {
            return { ...currValue, startPoint: currentPoint.point }
          }
        }
        if (currValue.state == "addNode") {
          const { snappedPoint, preview } = currValue
          if (snappedPoint) {
            onGraphChange(preview)
          }
          propagate = Propagate.NO
          onEditorStateChange("idle")
          return { state: "idle" }
        }
        if (currValue.state != "idle") {
          propagate = Propagate.NO
          onEditorStateChange("idle")
          return { state: "idle" }
        }
        return currValue
      })
      return propagate
    },
    [onGraphChange, onEditorStateChange],
  )

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      let propagate = Propagate.YES
      if (e.key === "Backspace" || e.key === "Delete") {
        setToolState((currValue) => {
          if (currValue.state == "selectedEdges") {
            onGraphChange(removeEdges(graph, currValue.selectedEdgeIDs))
            onEditorStateChange("idle")
            propagate = Propagate.NO
            return { state: "idle" }
          }
          if (currValue.state == "selectedVertex") {
            onGraphChange(removeVertex(graph, currValue.selectedVertexID))
            onEditorStateChange("idle")
            propagate = Propagate.NO
            return { state: "idle" }
          }
          return currValue
        })
      }
      if (e.altKey) {
        setToolState((currValue) => {
          if (currValue.state == "idle") {
            propagate = Propagate.NO
            onEditorStateChange("addNode")
            return { state: "addNode", preview: graph, isEnabledByAltKey: true }
          }
          return currValue
        })
      }
      return propagate
    },
    [graph, onGraphChange, onEditorStateChange],
  )

  const keyup = useCallback(
    (/* e: KeyboardEvent */) => {
      let propagate = Propagate.YES
      setToolState((currValue) => {
        if (currValue.state == "addNode" && currValue.isEnabledByAltKey) {
          propagate = Propagate.NO
          onEditorStateChange("idle")
          return { state: "idle" }
        }
        return currValue
      })
      return propagate
    },
    [onEditorStateChange],
  )

  useEventHandler("mousedown", mousedown, Priority.SUBTOOL, sceneManager.renderer.domElement)
  useEventHandler("mousemove", mousemove, Priority.SUBTOOL, sceneManager.renderer.domElement)
  useEventHandler("mouseup", mouseup, Priority.SUBTOOL, sceneManager.renderer.domElement)
  useEventHandler("keydown", keydown, Priority.SUBTOOL, sceneManager.renderer.domElement)
  useEventHandler("keyup", keyup, Priority.SUBTOOL, sceneManager.renderer.domElement)

  const graphToVisualize = useMemo(
    () =>
      toolState.state == "draggingVertex" ||
      toolState.state == "draggingEdge" ||
      toolState.state == "drawLine" ||
      toolState.state == "addNode"
        ? toolState.preview
        : graph,
    [graph, toolState],
  )

  const selection: HoveredItem[] = useMemo(
    () =>
      (toolState.state == "selectedVertex" && [{ type: "vertex", id: toolState.selectedVertexID }]) ||
      (toolState.state == "selectedEdges" && toolState.selectedEdgeIDs.map((e) => ({ type: "edge", id: e }))) ||
      [],
    [toolState],
  )

  const hover: HoveredItem[] = useMemo(
    () =>
      toolState.state == "idle" ||
      toolState.state == "mousedownVertex" ||
      toolState.state == "mousedownEdge" ||
      toolState.state == "selectedVertex" ||
      toolState.state == "selectedEdges"
        ? toolState.hovered
          ? [toolState.hovered]
          : []
        : [],
    [toolState],
  )

  const guidelines = useMemo(
    () =>
      (toolState.state == "draggingVertex" || toolState.state == "drawLine") &&
      (toolState.currentPoint?.type == "snappedToGuideLine" || toolState.currentPoint?.type == "snappedToWall")
        ? (toolState.currentPoint.guideLines?.map((g) => g.line) ?? [])
        : [],
    [toolState],
  )

  useEffect(() => {
    if (toolState.state == "drawLine") {
      drawCursor()
    } else if (toolState.state == "draggingEdge" || toolState.state == "draggingVertex") {
      moveCursor()
    } else if (toolState.state === "addNode") {
      addNodeCursor()
    }
    return () => defaultCursor()
  }, [toolState.state])

  return (
    <>
      <ExploreGraphVisuals graph={graphToVisualize} selection={selection} hover={hover} />
      {guidelines.length > 0 ? <SnappingGuidelineVisuals guidelines={guidelines} /> : null}
    </>
  )
}
