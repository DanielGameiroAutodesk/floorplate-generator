import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { useCallback, useEffect, useMemo } from "preact/compat"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import { CircleDefinedByRadialLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/CircleDefinedByRadialLineSegment"
import { DistanceOfLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DistanceOfLineSegment"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import { defaultCursor, drawCursor } from "src/integrations/cursors/setCursor"
import type { Shape } from "src/lib/three/Shape/types"
import type { Segment } from "src/lib/geometry/geometryTypes"

const DrawCircle: LineSegmentRenderer<{ onTerrain?: boolean }> = ({ lineSegment, onTerrain }) => {
  return (
    <>
      <CircleDefinedByRadialLineSegment lineSegment={lineSegment} onTerrain={onTerrain} />
      <DashedLineSegment lineSegment={lineSegment} />
      <DistanceOfLineSegment lineSegment={lineSegment} />
    </>
  )
}

export const DrawCircleGroundPolygon = ({
  onComplete,
  onPreviewChange,
  onTerrain,
}: {
  onComplete: (shape?: Shape, additionalProperties?: { [key: string]: any }) => any
  onPreviewChange?: (shape: Shape) => any
  onTerrain?: boolean
}) => {
  useEffect(() => {
    drawCursor()
    return () => defaultCursor()
  }, [])

  const handleComplete = useCallback(
    (segment: Segment) => {
      const shape = circleFrom2Points(segment[0], segment[1])
      onComplete(shape, {
        circleDefinition: segment,
      })
    },
    [onComplete],
  )

  const onCancel = useCallback(() => {
    return onComplete()
  }, [onComplete])

  const PreviewRenderer = useMemo(() => {
    const DrawCircleWithPreview: LineSegmentRenderer = ({ lineSegment: l }) => {
      useEffect(() => {
        if (!l || !onPreviewChange) return
        const shape = circleFrom2Points(l[0], l[1])
        onPreviewChange(shape)
      }, [l])
      return <DrawCircle lineSegment={l} onTerrain={onTerrain} />
    }
    return DrawCircleWithPreview
  }, [onPreviewChange, onTerrain])

  return <LineSegmentTool onCancel={onCancel} onComplete={handleComplete} previewRenderers={PreviewRenderer} />
}
