import { useCallback } from "preact/compat"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import { DRAW_LINE_ON_TERRAIN } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Properties } from "@spacemakerai/element-types"
import type { Shape } from "src/lib/three/Shape/types"
import { AT_LEAST_TWO_VERTICES } from "src/lib/three/Shape/shapeUtils"

type ToolProps = {
  onComplete: (shape?: Shape, additionalProperties?: { [key: string]: any }) => void
  onUpdate: (shape: Shape) => void
  onPreviewChange?: (shape: Shape, additionalProperties?: { [key: string]: any }) => void
  properties: Properties
}
export const LineOnTerrainTool = ({ properties, onComplete, onUpdate, onPreviewChange }: ToolProps) => {
  const onPreview = useCallback(
    (shape: Shape) => {
      onPreviewChange && onPreviewChange(shape, properties)
    },
    [onPreviewChange, properties],
  )

  const update = useCallback(
    (shape: Shape) => {
      if (AT_LEAST_TWO_VERTICES(shape)) {
        onUpdate(shape)
      }
    },
    [onUpdate],
  )

  const onCancel = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <ShapeTool
      isValid={AT_LEAST_TWO_VERTICES}
      onComplete={(s) => onComplete(s)}
      onUpdate={update}
      onCancel={onCancel}
      onPreviewChange={onPreview}
      config={DRAW_LINE_ON_TERRAIN}
    />
  )
}
