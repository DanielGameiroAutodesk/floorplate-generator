import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { Vector3 } from "three"
import { ShapeVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/ShapeVisual"
import { useSetRecoilState } from "recoil"
import {
  setSelectedInternalSnappingLinesSignalValue,
  setToolSnappingLinesCandidatesSignalValue,
} from "src/integrations/snapping/snappingPicker.state"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import type { Guide } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { AngleCornerVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/AngleCornerVisual"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import {
  connectNodeCursor,
  defaultCursor,
  drawCursor,
  moveCursor,
  moveVerticalCursor,
  rotateCursor,
} from "src/integrations/cursors/setCursor"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { isLineStringIntersectingOrHasLoopbacks2D } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import type { ShapeToolConfig } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { ShapeToolMoveMode, ToolIntention } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import sceneManager from "src/core/three/sceneManager"
import type { EditedShape } from "src/lib/three/Shape/shapeUtils"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import { createOrthogonalSnappingLine } from "src/integrations/snapping/utils/createSnapLines"
import type { Edge, Loop, Shape } from "src/lib/three/Shape/types"
import { samePoint } from "src/lib/three/geometryUtils"
import { isUndoRedoKeystroke } from "./IsUndoRedoKeystroke"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { useTranslator, type I18nStringProvider } from "src/i18n"

type Props = {
  onComplete: (shape: Shape) => any
  onUpdate?: (shape: Shape) => any
  placedShape: Shape
  onCancel: () => any
  closed: boolean
  useImperialUnits: boolean
  onPreviewChange?: (shape: Shape, withChanges: EditedShape) => any
  toolConfig: ShapeToolConfig
  singleLineSegment: boolean
  guide?: Guide
  enableSnappingPicker?: boolean
}

export const DrawLine = ({
  placedShape,
  onComplete,
  onUpdate,
  closed,
  onCancel,
  useImperialUnits,
  onPreviewChange,
  toolConfig,
  singleLineSegment,
  guide,
  enableSnappingPicker,
}: Props) => {
  const { onTerrain, useContextualLines, moveModes } = toolConfig
  const moveMode = moveModes ? moveModes[0] : ShapeToolMoveMode.TERRAIN
  const [vertices, setVertices] = useState<Vector3[]>(placedShape.vertices)
  const [edges, setEdges] = useState<Edge[]>([])
  const setGuideText = useSetRecoilState(guideTextAtom)
  const [currentPos, setCurrentPos] = useState<Vector3>(new Vector3())
  const terrainBin = terrainSignal.value.terrainSamplerData
  const predictedClosedLoop = useMemo(
    () => vertices.length >= 3 && samePoint(vertices[vertices.length - 1], currentPos),
    [vertices, currentPos],
  )
  const closedLoop = useMemo(() => vertices.length > 1 && samePoint(vertices[0], currentPos), [vertices, currentPos])
  const [currentPosByAngleInput, setCurrentPosByAngleInput] = useState<Vector3 | undefined>()

  const t = useTranslator()

  useEffect(() => {
    if (toolConfig.toolIntention === ToolIntention.Move) {
      if (toolConfig.moveModes.includes(ShapeToolMoveMode.VERTICAL)) {
        moveVerticalCursor()
      } else {
        moveCursor()
      }
    } else if (toolConfig.toolIntention === ToolIntention.Rotate) {
      rotateCursor()
    } else if (closedLoop) {
      connectNodeCursor()
    } else if (predictedClosedLoop) {
      drawCursor()
    } else {
      drawCursor()
    }
    if (!toolConfig.guideText) {
      const isMac = navigator.userAgent.toLowerCase().includes("mac")
      vertices.length >= 3
        ? closed
          ? setGuideText((): I18nStringProvider => (t) => t(($) => $.shapeTool.instructions.finishPolygon))
          : setGuideText((): I18nStringProvider => (t) => t(($) => $.shapeTool.instructions.finishEditing))
        : setGuideText(
            (): I18nStringProvider => (t) =>
              t(($) => $.shapeTool.instructions.activateGuideLines, { key: isMac ? "⌥ Option" : "Alt" }),
          )
    }
    return () => {
      if (!toolConfig.guideText) setGuideText(() => () => "")
      defaultCursor()
    }
  }, [
    closed,
    closedLoop,
    vertices,
    setGuideText,
    predictedClosedLoop,
    toolConfig.guideText,
    toolConfig.moveModes,
    toolConfig.toolIntention,
    t,
  ])

  useEffect(() => {
    if (vertices.length <= 1) setSelectedInternalSnappingLinesSignalValue([])
    if (vertices.length > 1) {
      const lines = [
        [vertices[vertices.length - 1], vertices[vertices.length - 2]],
        [vertices[0], vertices[1]],
      ].map(([start, end]) => snappingLineFromEndpoints(start, end, "ENDPOINT_RIGHT_ANGLE", onTerrain, terrainBin))

      setSelectedInternalSnappingLinesSignalValue(lines)
    }
  }, [vertices, onTerrain, terrainBin])

  useEffect(() => {
    const linesCandidates = edges.map(([start, end]) =>
      snappingLineFromEndpoints(vertices[start], vertices[end], "LINE", onTerrain, terrainBin),
    )

    setToolSnappingLinesCandidatesSignalValue(linesCandidates)
  }, [edges, onTerrain, terrainBin, vertices])

  useEffect(() => {
    if (currentPosByAngleInput !== undefined) {
      setCurrentPos(currentPosByAngleInput)
    }
  }, [currentPosByAngleInput])

  const currentShapeSnappingLines = useMemo(() => {
    const placedLines: SnappingLine[] = placedShape.edges.map(([start, end]) =>
      snappingLineFromEndpoints(placedShape.vertices[start], placedShape.vertices[end], "LINE", onTerrain, terrainBin),
    )

    const currentLines: SnappingLine[] = edges.map(([start, end]) =>
      snappingLineFromEndpoints(vertices[start], vertices[end], "LINE", onTerrain, terrainBin),
    )

    let orthogonalToStart: SnappingLine[] = []
    if (currentLines[0]) {
      orthogonalToStart.push(
        createOrthogonalSnappingLine(currentLines[0], currentLines[0].start, terrainBin, currentLines[0].shapeId),
      )
    }
    return placedLines.concat(currentLines).concat(orthogonalToStart)
  }, [placedShape, edges, vertices, onTerrain, terrainBin])

  const closeAndSubmit = useCallback(() => {
    const newShape = ShapeUtils.closeEdgesAndCreateLoopFromShape({
      vertices,
      edges,
      loops: [],
    })
    onComplete(newShape)
    setEdges([])
    setVertices([])
  }, [edges, onComplete, vertices])

  const addCurrentPosAsVertex = useCallback(() => {
    const newVertices = [...vertices]

    if (vertices.length === 0 || !samePoint(currentPos, vertices[vertices.length - 1])) {
      newVertices.push(currentPos)
    }
    const edges: Edge[] = []

    setVertices(newVertices)
    for (let i = 0; i < newVertices.length - 1; i++) {
      edges.push([i, i + 1])
    }
    setEdges(edges)
    if (newVertices.length > 1) {
      const closedLoop = newVertices.length > 1 && samePoint(newVertices[0], newVertices[newVertices.length - 1])
      if (closedLoop) {
        newVertices.pop()
        edges.pop()
        edges.push([newVertices.length - 1, 0])
      }
    }
    onUpdate && onUpdate({ vertices: newVertices, edges, loops: [] })
    if (singleLineSegment && newVertices.length >= 2) {
      onComplete({
        vertices: newVertices,
        edges,
        loops: [],
      })
      setEdges([])
      setVertices([])
    }

    return newVertices
  }, [vertices, currentPos, onUpdate, singleLineSegment, onComplete])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (isUndoRedoKeystroke(e) === "undo" && vertices.length > 0) {
        const newShape = ShapeUtils.pruneEditedShape(
          ShapeUtils.removeVertex({ edges, vertices, loops: [] }, vertices.length - 1),
        )
        setEdges(newShape.edges)
        setVertices(newShape.vertices)
        onUpdate && onUpdate(newShape)
        e.preventDefault()
        e.stopPropagation()
        return Propagate.NO
      }
      switch (e.key) {
        case "Enter":
          if (vertices.length > 2) {
            if (closed) {
              closeAndSubmit()
            } else {
              onComplete({
                vertices,
                edges,
                loops: [],
              })
            }
            return Propagate.NO
          }
          if (!closed) {
            onComplete({
              vertices,
              edges,
              loops: [],
            })
            return Propagate.NO
          }
          return Propagate.YES
        default:
          return Propagate.YES
      }
    },
    [closeAndSubmit, closed, edges, onComplete, onUpdate, vertices],
  )

  const selfIntersecting = useMemo(() => {
    const checkedLine = [...vertices]
    if (vertices.length > 0 && !samePoint(currentPos, vertices[vertices.length - 1])) {
      checkedLine.push(currentPos)
    }
    let b = isLineStringIntersectingOrHasLoopbacks2D(checkedLine)
    return b
  }, [vertices, currentPos])

  const mouseup = useCallback(
    (e: MouseEvent): Propagate => {
      if (e.button !== 0) return Propagate.YES
      if (selfIntersecting) return Propagate.YES
      e.stopPropagation()
      e.preventDefault()

      //Clicked last vertex again
      if (
        (vertices.length > 2 || (!closed && vertices.length >= 2)) &&
        samePoint(currentPos, vertices[vertices.length - 1])
      ) {
        if (closed && vertices.length > 2) {
          closeAndSubmit()
        } else {
          onComplete({
            vertices,
            edges,
            loops: [],
          })
          setEdges([])
          setVertices([])
        }
        return Propagate.NO
      }

      //Clicked first point
      if (vertices.length > 2 && samePoint(currentPos, vertices[0])) {
        if (closed) {
          closeAndSubmit()
        } else {
          let newVertices = vertices.concat(currentPos)
          let newEdges: Edge[] = [...edges, [vertices.length - 1, vertices.length]]
          onComplete({
            vertices: newVertices,
            edges: newEdges,
            loops: [],
          })
          setEdges([])
          setVertices([])
        }
      }

      addCurrentPosAsVertex()

      return Propagate.NO
    },
    [selfIntersecting, closed, vertices, currentPos, addCurrentPosAsVertex, closeAndSubmit, edges, onComplete],
  )

  useEventHandler("mouseup", mouseup, Priority.SUBTOOL, sceneManager.canvas)
  useEventHandler("keydown", keydown, Priority.SUBTOOL)

  const previewShape: Shape | undefined = useMemo(() => {
    const liveEdge: Edge = [vertices.length - 1, vertices.length]
    const closed = vertices.length >= 2 && currentPos.equals(vertices[0])
    const previewEdges = [...edges, liveEdge]
    const loops: Loop[] = closed ? [previewEdges.map((_, i) => i)] : []
    return {
      vertices: [...vertices, currentPos],
      edges: previewEdges,
      loops: loops,
    }
  }, [edges, vertices, currentPos])

  useEffect(() => {
    if (!onPreviewChange || !previewShape) return
    onPreviewChange(previewShape, previewShape)
  }, [onPreviewChange, previewShape])

  const commitCurrentPreviewShape = useCallback(() => {
    addCurrentPosAsVertex()
  }, [addCurrentPosAsVertex])

  return (
    <>
      <ShapeVisual
        shape={previewShape}
        onTerrain={onTerrain}
        valid={!selfIntersecting}
        closed={closed}
        useImperialUnits={useImperialUnits}
      />
      <AngleCornerVisual
        startPoint={vertices[vertices.length - 2]}
        pivotPoint={vertices[vertices.length - 1]}
        currentPoint={currentPos}
      />
      <CalculateMousePosition
        startPoint={vertices[vertices.length - 1]}
        onTerrain={onTerrain}
        currentShapeSnappingLines={currentShapeSnappingLines}
        onCancel={onCancel}
        onChange={setCurrentPos}
        placedVertices={vertices}
        setCurrentPosByAngleInput={vertices.length < 2 ? undefined : setCurrentPosByAngleInput}
        moveMode={moveMode}
        useDerivedSnappingLines={useContextualLines}
        commitCurrentPreview={commitCurrentPreviewShape}
        hideFloatingInputs={toolConfig.hideFloatingInputs}
        guide={guide}
        enableSnappingPicker={enableSnappingPicker}
      />
    </>
  )
}
