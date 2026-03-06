import type { Guide } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { Vector3 } from "three"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/compat"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import type { FunctionalComponent } from "preact"
import sceneManager from "src/core/three/sceneManager"
import type { Segment } from "src/lib/geometry/geometryTypes"
import { enableSnappingSignal, setSnapToExternalSignalValue } from "src/integrations/snapping/snappingPicker.state"

type Props = {
  onCancel: () => any
  onComplete: (lineSegment: Segment) => any
  initialDefinition?: Segment
  previewRenderers: LineSegmentRenderer | LineSegmentRenderer[]
  guide?: Guide
  moveMode?: ShapeToolMoveMode
  enterToComplete?: boolean
  hideFloatingInputs?: boolean
  ignoreTerrainSnappingLines?: boolean
}

type PreviewRendererProps<T = object> = {
  lineSegment: Segment | undefined
} & T
export type LineSegmentRenderer<T = object> = FunctionalComponent<PreviewRendererProps<T>>

const CLICK_DELAY = 200

export const LineSegmentTool = ({
  onCancel,
  onComplete,
  initialDefinition,
  previewRenderers,
  guide,
  moveMode = ShapeToolMoveMode.HORIZONTAL,
  enterToComplete = true,
  hideFloatingInputs = false,
  ignoreTerrainSnappingLines,
}: Props) => {
  const renderers = [previewRenderers].flat(2)

  useEffect(() => {
    setSnapToExternalSignalValue(true)
  }, [])

  const [startPoint, setStartPoint] = useState<Vector3 | undefined>(
    initialDefinition ? new Vector3().fromArray(initialDefinition[0]) : undefined,
  )

  const [mousePos, setMousePos] = useState<Vector3 | undefined>(
    initialDefinition ? new Vector3().fromArray(initialDefinition[1]) : undefined,
  )

  const lineSegment: Segment | undefined = useMemo(() => {
    if (!startPoint || !mousePos) return undefined
    return [startPoint.toArray(), mousePos.toArray()]
  }, [startPoint, mousePos])

  const onMousePosChange = useCallback((pos: Vector3) => {
    setMousePos(pos)
  }, [])

  const complete = useCallback(() => {
    if (!lineSegment) return
    onComplete(lineSegment)
  }, [lineSegment, onComplete])

  const mouseDownTime = useRef(Infinity)
  useEffect(
    () =>
      void setTimeout(() => {
        // use setTimeout to queue a macrotask so our time measurement isn't influenced by anything that blocks the main thread
        mouseDownTime.current = Date.now()
      }, 0),
    [],
  )

  const mousedown = useCallback(() => {
    if (!startPoint) {
      setStartPoint(mousePos)
      setTimeout(() => {
        mouseDownTime.current = Date.now()
      }, 0)
    }

    return Propagate.NO
  }, [startPoint, mousePos])

  const mouseup = useCallback(() => {
    if (startPoint && mousePos && Date.now() - mouseDownTime.current > CLICK_DELAY) {
      complete()
    }
    return Propagate.NO
  }, [startPoint, mousePos, complete])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onCancel()
          return Propagate.NO
        case "Enter":
          if (enterToComplete) {
            complete()
            return Propagate.NO
          } else {
            return Propagate.YES
          }
        default:
          return Propagate.YES
      }
    },
    [onCancel, enterToComplete, complete],
  )
  useEventHandler("keydown", keydown, Priority.TOOL)
  useEventHandler("mousedown", mousedown, Priority.TOOL, sceneManager.canvas)
  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.canvas)

  return (
    <>
      {renderers.map((Renderer) => (
        <Renderer lineSegment={lineSegment} key={Renderer.name} />
      ))}
      {!startPoint && mousePos && <Handle position={mousePos} />}

      <CalculateMousePosition
        onTerrain={moveMode === ShapeToolMoveMode.TERRAIN}
        onChange={onMousePosChange}
        moveMode={moveMode}
        startPoint={startPoint}
        guide={guide}
        commitCurrentPreview={complete}
        hideFloatingInputs={hideFloatingInputs}
        ignoreTerrainSnappingLines={ignoreTerrainSnappingLines}
        enableSnappingPicker={enableSnappingSignal.value}
      />
    </>
  )
}
