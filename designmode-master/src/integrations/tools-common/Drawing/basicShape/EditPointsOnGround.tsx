import { useCallback, useState } from "react"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import type { CompleteCallbackEditPoint, PointsPreviewComponent } from "src/integrations/draw/DrawAPI"
import type { Object3D } from "three"
import { Group, Vector3 } from "three"
import { SNAPPING_SENSITIVITY_SQ } from "src/integrations/snapping/constants"
import { useLayoutEffect, useMemo } from "preact/compat"
import { dispose } from "src/core/three/useObjectLifecycle"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import sceneManager from "src/core/three/sceneManager"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import { isDefined } from "src/lib/array"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"

export type EditPoint = { point: Vec3; id: string }

export default function EditPointsOnGround({
  points,
  onCommit,
  onChange,
  PreviewComponent,
}: {
  points: EditPoint[]
  onCommit: CompleteCallbackEditPoint
  onChange?: CompleteCallbackEditPoint
  PreviewComponent?: PointsPreviewComponent
}) {
  const [movingPoint, setMovingPoint] = useState<EditPoint | undefined>(undefined)

  const onMouseDown = useCallback(() => {
    if (movingPoint) {
      console.error("Unexpectedly got new mouse down while already editing a point")
      return Propagate.YES
    }
    const intersection = raycastApi.raycastMousePosition()
    const currentMousePosition = intersection?.position

    if (!currentMousePosition) return Propagate.YES

    const currentPosVector = new Vector3(currentMousePosition.x, currentMousePosition.y, currentMousePosition.z)

    const snappingDistance = pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, sceneManager.camera, currentPosVector)

    const startPoint = points.find(
      (p) => currentPosVector.distanceToSquared(new Vector3(p.point.x, p.point.y, p.point.z)) < snappingDistance,
    )
    if (startPoint) {
      setMovingPoint(startPoint)
      return Propagate.NO
    }
    return Propagate.YES
  }, [movingPoint, points])

  const onMouseUp = useCallback(() => {
    setMovingPoint(undefined)
    const intersection = raycastApi.raycastMousePosition()
    const currentMousePosition = intersection?.position
    if (currentMousePosition && movingPoint) {
      onCommit({
        point: currentMousePosition,
        id: movingPoint.id,
      })
    }
    return Propagate.YES
  }, [movingPoint, onCommit])

  const onMouseMove = useCallback(() => {
    if (!movingPoint) return Propagate.YES

    const intersection = raycastApi.raycastMousePosition()
    const currentMousePosition = intersection?.position

    if (!currentMousePosition) return Propagate.YES

    const updatedPoint: EditPoint = { ...movingPoint, point: currentMousePosition }

    setMovingPoint((prev) => (isDefined(prev) ? updatedPoint : prev))
    if (onChange) onChange(updatedPoint)

    return Propagate.NO
  }, [movingPoint, onChange])

  useEventHandler("mouseup", onMouseUp, Priority.TOOL_INPUT_CONTROL)
  useEventHandler("mousedown", onMouseDown, Priority.TOOL_INPUT_CONTROL)
  useEventHandler("mousemove", onMouseMove, Priority.TOOL_INPUT_CONTROL)

  const previewPoints: Vec3[] = useMemo(() => {
    return (movingPoint ? points.map((p) => (p.id === movingPoint.id ? movingPoint : p)) : points).map((p) => p.point)
  }, [points, movingPoint])
  return <>{previewPoints.length > 0 && PreviewComponent && <PreviewComponent points={previewPoints} />}</>
}

const pointsGroup = new Group()
export function PointsRenderer({ points }: { points: Vec3[] }) {
  const { useObjectLifecycle_TEMPORARY_FIX } = useRenderAPI("EditPointsOnGround")
  useLayoutEffect(() => {
    for (let i = points.length - 1; i >= 0; i--) {
      const point: Object3D | undefined = pointsGroup.children[i]
      if (point) {
        pointsGroup.remove(point)
        dispose(point)
      }
    }
    for (let i = 0; i < points.length; i++) {
      const vertexHandle = new VertexHandle(new Vector3(points[i].x, points[i].y, points[i].z))
      pointsGroup.add(vertexHandle)
    }
    sceneManager.render()
  }, [points])
  useObjectLifecycle_TEMPORARY_FIX(pointsGroup)
  return null
}
