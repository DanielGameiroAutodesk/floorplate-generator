import { Vector3 } from "three"
import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { ShapeVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/ShapeVisual"
import { Move } from "./Move"
import { indexOfEdgesInHoverDistance } from "./selection/edgeSelection"
import { indexOfPointsInHoverDistance } from "./selection/pointSelection"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { useSetRecoilState } from "recoil"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import {
  addNodeCursor,
  defaultCursor,
  deleteNodeCursor,
  drawCursor,
  setPointerCursor,
} from "src/integrations/cursors/setCursor"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { isOnMac } from "src/lib/measurementSystem"
import { mousePosition } from "src/core/useMousePosition"
import type { ShapeToolConfig } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Guide } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import type { EditedShape } from "src/lib/three/Shape/shapeUtils"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { projectPositionToTerrain } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import type { Shape } from "src/lib/three/Shape/types"
import type { I18nStringProvider } from "src/i18n"

type Props = {
  shape: Shape
  onComplete: (shapeWithChanges: EditedShape) => any
  onChange?: (shape: Shape, shapeWithChanges: EditedShape) => any
  isValid: (shape: Shape) => boolean
  useImperialUnits: boolean
  config: ShapeToolConfig
  guide?: Guide
  enableSnappingPicker?: boolean
  discreteLength?: number
}

const distanceVec = new Vector3()

function sameXY(v1: Vector3, v2: Vector3) {
  return distanceVec.subVectors(v1, v2).setZ(0).length() < 0.0001
}

function verticesAtSameXY(shape: Shape, index: number): number[] {
  let positionAtIndex = shape.vertices[index]
  return shape.vertices.reduce((previousValue, currentValue, currentIndex) => {
    if (sameXY(currentValue, positionAtIndex)) previousValue.push(currentIndex)
    return previousValue
  }, [] as number[])
}

const reusableVector = new Vector3()
export const Edit = ({
  shape,
  onComplete,
  onChange,
  isValid,
  useImperialUnits,
  config,
  guide,
  enableSnappingPicker,
  discreteLength,
}: Props) => {
  const { onTerrain, linkVerticesVertically, activeVertices } = config
  const [pos, setPos] = useState<Vector3>(new Vector3())
  const [moveStart, setMoveStart] = useState(new Vector3())
  const shapeBeforeEdit = useState(shape)
  const [hoveredVertexIdx, setHoveredVertexIdx] = useState<number>(-1)
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number>(-1)
  const [modifiedVertices, setModifiedVertices] = useState<number[]>([])
  const setGuideText = useSetRecoilState(guideTextAtom)
  const [addRemoveVertexMode, setAddRemoveVertexMode] = useState(false)

  useEffect(() => {
    if (activeVertices && activeVertices.length > 0) {
      setMoveStart(shape.vertices[activeVertices[0]])
      setPos(shape.vertices[activeVertices[0]])
      setModifiedVertices(activeVertices)
    }
  }, [activeVertices, shape, pos])

  useEffect(() => {
    if (addRemoveVertexMode) {
      setGuideText((): I18nStringProvider => (t) => t(($) => $.shapeTool.instructions.clickToAddSubtract))
    }

    if (addRemoveVertexMode && hoveredVertexIdx < 0 && hoveredEdgeIdx < 0) {
      drawCursor()
    } else if (addRemoveVertexMode && hoveredVertexIdx >= 0) {
      deleteNodeCursor()
    } else if (addRemoveVertexMode && hoveredEdgeIdx >= 0) {
      addNodeCursor()
    } else if (hoveredEdgeIdx < 0 && hoveredVertexIdx < 0 && modifiedVertices.length === 0) {
      setGuideText(
        (): I18nStringProvider => (t) =>
          isOnMac
            ? t(($) => $.shapeTool.instructions.editModeStartFinishMac)
            : t(($) => $.shapeTool.instructions.editModeStartFinishWindows),
      )
      setPointerCursor()
    } else {
      defaultCursor()
    }

    return defaultCursor
  }, [
    modifiedVertices,
    hoveredEdgeIdx,
    hoveredVertexIdx,
    addRemoveVertexMode,
    setGuideText,
    shapeBeforeEdit,
    shape,
    moveStart,
  ])

  const mousemove = useCallback((): Propagate => {
    if (shape.vertices.length === 0) return Propagate.YES

    let newPos: Vector3 | undefined

    let vertex = indexOfPointsInHoverDistance(mousePosition, shape.vertices)
    if (vertex >= 0) {
      newPos = shape.vertices[vertex]
    }

    let edge = -1
    if (vertex < 0) {
      const atEdge = indexOfEdgesInHoverDistance(mousePosition.ray, shape, onTerrain)
      edge = atEdge.index
      if (atEdge.position) {
        newPos = atEdge.position
      }
    }

    setHoveredVertexIdx(vertex)

    setHoveredEdgeIdx(edge)

    if (newPos) {
      setPos(newPos)
    }

    return Propagate.YES
  }, [shape, onTerrain])

  useEffect(() => {
    mousemove()
  }, [mousemove])
  useEventHandler("mousemove", mousemove, Priority.SUBTOOL)

  const addOrRemoveVertex = useCallback(() => {
    if (hoveredVertexIdx >= 0) {
      let newShape = ShapeUtils.removeVertex(shape, hoveredVertexIdx)
      setPreviewShape(newShape)
      onComplete(newShape)
    } else if (hoveredEdgeIdx >= 0) {
      let newShape = ShapeUtils.addPointOnEdge(shape, hoveredEdgeIdx, pos)
      setPreviewShape(newShape)
      onComplete(newShape)
    }
    return Propagate.NO
  }, [hoveredEdgeIdx, hoveredVertexIdx, shape, pos, onComplete])

  const mousedown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.YES
      if (modifiedVertices.length) return Propagate.YES
      if (addRemoveVertexMode) {
        addOrRemoveVertex()
      } else {
        if (hoveredVertexIdx >= 0) {
          setModifiedVertices(linkVerticesVertically ? verticesAtSameXY(shape, hoveredVertexIdx) : [hoveredVertexIdx])
        } else if (hoveredEdgeIdx >= 0) {
          let vertices: number[] = shape.edges[hoveredEdgeIdx]
          if (vertices && vertices.length && linkVerticesVertically) {
            vertices = vertices.flatMap((v) => verticesAtSameXY(shape, v))
          }
          setModifiedVertices(vertices)
        }
        setMoveStart(pos)
        return Propagate.NO
      }

      return Propagate.YES
    },
    [
      modifiedVertices.length,
      addRemoveVertexMode,
      addOrRemoveVertex,
      hoveredVertexIdx,
      hoveredEdgeIdx,
      pos,
      linkVerticesVertically,
      shape,
    ],
  )
  useEventHandler("mousedown", mousedown, Priority.SUBTOOL)

  const [refPoint, setRefPoint] = useState<number>(0)

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "'":
          setRefPoint(refPoint + 1)
          return Propagate.NO
        case "Alt":
          setAddRemoveVertexMode(true)
          return Propagate.NO
      }
      return Propagate.YES
    },
    [refPoint],
  )

  useEventHandler("keydown", keydown, Priority.SUBTOOL)

  const keyup = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case "Alt":
        setAddRemoveVertexMode(false)
        e.preventDefault()
        e.stopPropagation()
        return Propagate.NO
    }
    return Propagate.YES
  }, [])

  useEventHandler("keyup", keyup, Priority.SUBTOOL)

  const [previewShape, setPreviewShape] = useState<EditedShape>(shape)
  const maxActiveVertex = activeVertices ? Math.max(...activeVertices) : 0
  const moveVertices = useCallback(
    (moveEnd: Vector3) => {
      if (modifiedVertices.length === 0) return
      const move = reusableVector.subVectors(moveEnd, moveStart)
      // only remove duplicates if that doesn't lead to losing one of the active vertices
      const removeDuplicates = shape.vertices.length > maxActiveVertex + 1
      let newShape = ShapeUtils.translateVertices(shape, modifiedVertices, move, removeDuplicates)
      if (onTerrain) {
        newShape.vertices.forEach((v, i) => {
          if (v && modifiedVertices.includes(i)) projectPositionToTerrain(v, v)
        })
      }
      const pruned = ShapeUtils.pruneEditedShape(newShape)
      setPreviewShape(pruned)
    },
    [modifiedVertices, moveStart, shape, maxActiveVertex, onTerrain],
  )

  const valid = useMemo(() => isValid(ShapeUtils.pruneEditedShape(previewShape)), [isValid, previewShape])

  const onMoveComplete = useCallback(() => {
    if (!valid) return
    setModifiedVertices([])
    onComplete(previewShape)
  }, [previewShape, onComplete, valid])

  useEffect(() => {
    onChange && onChange(ShapeUtils.pruneEditedShape(previewShape), previewShape)
    if (previewShape !== shape) {
      setGuideText((): I18nStringProvider => (t) => t(($) => $.shapeTool.instructions.specifyDistance))
    }
    return () => setGuideText(() => () => "")
  }, [onChange, previewShape, shape, setGuideText])

  const refPos = useMemo(() => {
    if (modifiedVertices.length > 1) return moveStart

    const connectedToModified = Array.from(
      new Set(
        shape.edges
          .filter((e) => e.some((v) => modifiedVertices.includes(v)))
          .flatMap((e) => e)
          .filter((v) => !modifiedVertices.includes(v)),
      ),
    ).map((v) => shape.vertices[v])

    const relevantRefPoints = [moveStart, ...connectedToModified]

    return relevantRefPoints[refPoint % relevantRefPoints.length]
  }, [shape, modifiedVertices, refPoint, moveStart])

  return (
    <>
      {modifiedVertices.length > 0 && (
        <Move
          shape={shape}
          startPos={moveStart}
          onMove={moveVertices}
          onComplete={onMoveComplete}
          useImperialUnits={useImperialUnits}
          toolConfig={config}
          refPos={refPos}
          guide={guide}
          enableSnappingPicker={enableSnappingPicker}
          discreteLength={discreteLength}
        />
      )}

      <ShapeVisual
        shape={ShapeUtils.pruneEditedShape(previewShape)}
        hoveredEdge={hoveredEdgeIdx}
        hoveredVertex={hoveredVertexIdx}
        onTerrain={onTerrain}
        valid={valid}
        useImperialUnits={useImperialUnits}
      />
      {addRemoveVertexMode && hoveredEdgeIdx !== -1 && <Handle position={pos} hovered={false} />}
    </>
  )
}
