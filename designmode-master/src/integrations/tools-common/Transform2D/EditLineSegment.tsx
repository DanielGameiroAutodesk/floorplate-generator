import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { Vector3 } from "three"
import { useEffect, useState } from "preact/hooks"
import { useCallback, useMemo } from "preact/compat"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { mousePosition } from "src/core/useMousePosition"
import { indexOfPointsInHoverDistance } from "src/integrations/tools-common/Drawing/shapeTool/subtools/Edit/selection/pointSelection"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { defaultCursor, moveCursor } from "src/integrations/cursors/setCursor"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import sceneManager from "src/core/three/sceneManager"
import type { Segment } from "src/lib/geometry/geometryTypes"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"

type Props = {
  lineSegment: Segment
  onCancel: () => void
  onComplete: (lineSegment: Segment) => void
  previewRenderers: LineSegmentRenderer | LineSegmentRenderer[]
  onUpdate?: (lineSegment: Segment) => void
  customCursorFunction?: () => void
}
export const EditLineSegment = ({ lineSegment, previewRenderers, onComplete, onUpdate }: Props) => {
  useEffect(() => {}, [previewRenderers])
  const [start, setStart] = useState<Vector3 | undefined>()
  const [end, setEnd] = useState<Vector3 | undefined>()

  useEffect(() => {
    setStart(new Vector3().fromArray(lineSegment[0]))
    setEnd(new Vector3().fromArray(lineSegment[1]))
  }, [lineSegment])

  const complete = useCallback(() => {
    if (!start || !end) return
    onComplete([start.toArray() as [number, number, number], end.toArray() as [number, number, number]])
  }, [start, end, onComplete])

  const [hoveredVertexIdx, setHoveredVertexIdx] = useState<number>(-1)

  const mousemove = useCallback((): Propagate => {
    if (!start || !end) return Propagate.YES

    const indexOfHovered = indexOfPointsInHoverDistance(mousePosition, [start, end])
    setHoveredVertexIdx(indexOfHovered)
    return indexOfHovered !== -1 ? Propagate.NO : Propagate.YES
  }, [start, end])

  const [activeVertexId, setActiveVertexId] = useState<number>(-1)

  const [dragStart, setDragStart] = useState<Vector3>()

  const placeCurrentVertex = useCallback(() => {
    setActiveVertexId(-1)
    onUpdate?.([start?.toArray() as [number, number, number], end?.toArray() as [number, number, number]])
  }, [start, end, onUpdate])

  const mousedown = useCallback((): Propagate => {
    if (activeVertexId === -1 && hoveredVertexIdx === -1) return Propagate.YES
    if (activeVertexId >= 0) {
      placeCurrentVertex()
    } else {
      setActiveVertexId(hoveredVertexIdx)
      if (hoveredVertexIdx >= 0) {
        setDragStart(hoveredVertexIdx === 0 ? start : end)
      }
    }
    return Propagate.NO
  }, [hoveredVertexIdx, activeVertexId, start, end, placeCurrentVertex])

  const mouseup = useCallback((): Propagate => {
    if (activeVertexId === -1 || !start || !end || !dragStart) return Propagate.YES
    const movedPoint = activeVertexId === 0 ? start : end
    const distance = dragStart?.distanceTo(movedPoint)
    if (pixelsToMetersAtPosition(5, sceneManager.camera, movedPoint) < distance) {
      placeCurrentVertex()
    }
    setDragStart(undefined)
    return Propagate.YES
  }, [dragStart, activeVertexId, start, end, placeCurrentVertex])

  useEffect(() => {
    if (activeVertexId >= 0 || hoveredVertexIdx >= 0) {
      moveCursor()
    }

    return () => {
      defaultCursor()
    }
  }, [activeVertexId, hoveredVertexIdx])

  const dblClick = useCallback(() => {
    if (hoveredVertexIdx >= 0 || activeVertexId >= 0) return Propagate.YES
    complete()
    return Propagate.NO
  }, [complete, hoveredVertexIdx, activeVertexId])

  useEventHandler("mousemove", mousemove, Priority.SUBTOOL)
  useEventHandler("mousedown", mousedown, Priority.SUBTOOL)
  useEventHandler("mouseup", mouseup, Priority.SUBTOOL)
  useEventHandler("dblclick", dblClick, Priority.SUBTOOL)

  // TODO: refactor this
  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Tab" && activeVertexId >= 0) {
        return Propagate.NO
      } else if (e.key === "Enter") {
        if (activeVertexId >= 0) {
          placeCurrentVertex()
        } else {
          complete()
        }
        return Propagate.NO
      }
      return Propagate.YES
    },
    [activeVertexId, placeCurrentVertex, complete],
  )
  useEventHandler("keydown", keydown, Priority.SUBTOOL)

  const renderers = [previewRenderers].flat(2)
  const previewSegment: Segment | undefined = useMemo(() => {
    if (!start || !end) return undefined
    return [start.toArray() as [number, number, number], end.toArray() as [number, number, number]]
  }, [start, end])

  const onMousePosChange = useCallback(
    (newPos: Vector3) => {
      if (activeVertexId === 0) {
        setStart(newPos)
      } else if (activeVertexId === 1) {
        setEnd(newPos)
      }
    },
    [activeVertexId],
  )

  const finishHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.finishEditing),
      callback: complete,
      editAccessRequired: true,
      keyCode: "Enter",
    }
  }, [complete])

  useHotkey(finishHotkey)

  return (
    <>
      {previewSegment && renderers.map((Renderer) => <Renderer lineSegment={previewSegment} key={Renderer.name} />)}
      {activeVertexId !== -1 && (
        <CalculateMousePosition
          onTerrain={true}
          onChange={onMousePosChange}
          startPoint={activeVertexId === 0 ? end : start}
          commitCurrentPreview={placeCurrentVertex}
        />
      )}
      {start && <Handle position={start} hovered={hoveredVertexIdx === 0} />}
      {end && <Handle position={end} hovered={hoveredVertexIdx === 1} />}
    </>
  )
}
