import { useEffect, useCallback } from "preact/hooks"
import { PickElement } from "src/integrations/tools-common/Drawing/basicShape/PickElement"
import { isDefined } from "src/lib/array"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { Shape } from "src/lib/three/Shape/types"
import type { Vector3 } from "three"
import { defaultRadiusSignal } from "src/integrations/transportation/PropertyPanels/DrawingProperties"

function getShapePoints(shape: Shape) {
  const vertices = ShapeUtils.connectedVerticesOfShape(shape)
  return vertices.filter(isDefined)
}

export const RoadTraceShape = ({
  onCancelDraw,
  onCompleteDraw,
}: {
  onCancelDraw: () => void
  onCompleteDraw: (vecs: Vector3[]) => void
}) => {
  useEffect(() => {
    const currentDefaultRadius = defaultRadiusSignal.peek()
    defaultRadiusSignal.value = 0
    return () => (defaultRadiusSignal.value = currentDefaultRadius)
  }, [])

  const completePickLine = useCallback(
    (shape: Shape) => {
      const points = getShapePoints(shape)
      onCompleteDraw(points)
    },
    [onCompleteDraw],
  )

  const completePickPolygon = useCallback(
    (shape: Shape) => {
      const points = getShapePoints(shape)
      points.push(points[0])
      onCompleteDraw(points)
    },
    [onCompleteDraw],
  )

  return (
    <PickElement
      onCancel={onCancelDraw}
      onPolygonPicked={completePickPolygon}
      onExtrudedPolygonPicked={completePickPolygon}
      onLinePicked={completePickLine}
    />
  )
}
