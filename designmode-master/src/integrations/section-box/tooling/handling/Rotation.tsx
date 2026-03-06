import { useCallback, useEffect, useState } from "preact/hooks"
import { getRotationFromShape } from "src/integrations/tools-common/AffineTooling/PreciseRotate"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import {
  CreateToolMode,
  ShapeToolMoveMode,
  ToolIntention,
  type ShapeToolConfig,
} from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Shape } from "src/lib/three/Shape/types"
import { applyRotationToSectionBox, getSectionBoxMidPoint } from "src/integrations/section-box/tooling/sectionBox"
import { exitCurrentTool } from "src/core/toolsState"
import {
  selectedSectionBoxSignal,
  setSectionBoxPreviewSignal,
  commitSelectedSectionBox,
} from "src/integrations/section-box/state"
import { setEnableSnappingSignalValue } from "src/integrations/snapping/snappingPicker.state"
import { trackEditSectionBox } from "src/integrations/section-box/analytics"

const COMPLETE_STEP: ShapeToolConfig = {
  requireAlwaysValid: true,
  toolMode: CreateToolMode.DrawLineSegment,
  toolIntention: ToolIntention.Rotate,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  activeVertices: [0],
  onTerrain: false,
  linkVerticesVertically: false,
  useContextualLines: true,
  snapToExternalShape: true,
  hideFloatingInputs: true,
}
const DEFINE_REFERENCE_LINE: ShapeToolConfig = {
  requireAlwaysValid: true,
  toolIntention: ToolIntention.Rotate,
  toolMode: CreateToolMode.DrawLineSegment,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  onTerrain: false,
  useContextualLines: true,
  linkVerticesVertically: false,
  snapToExternalShape: true,
  hideFloatingInputs: true,
}

export function Rotate() {
  useEffect(() => {
    setEnableSnappingSignalValue(false)
    return () => {
      setEnableSnappingSignalValue(true)
    }
  }, [])

  const sectionBox = selectedSectionBoxSignal.value
  const midPoint = getSectionBoxMidPoint(sectionBox?.box)
  const initialState = midPoint
    ? {
        vertices: [midPoint],
        edges: [],
        loops: [],
      }
    : undefined

  const [initialShape, setInitialShape] = useState<Shape | undefined>(initialState)

  const isLineValid = (shape: Shape) => shape.vertices.length >= 2

  const onCompleteLine = useCallback((shape: Shape) => {
    const shapeWithExtraVertex: Shape = {
      ...shape,
      vertices: shape.vertices.reverse(),
      edges: [[1, 0]],
    }
    setInitialShape(shapeWithExtraVertex)
  }, [])

  const onCancel = useCallback(() => {
    setSectionBoxPreviewSignal(undefined)
    exitCurrentTool()
  }, [])

  const onCompleteTool = useCallback(
    (shape: Shape) => {
      if (!sectionBox) return
      const { matrix4: affineMatrix } = getRotationFromShape(shape)
      const newSectionBox = applyRotationToSectionBox(sectionBox.box, affineMatrix)
      commitSelectedSectionBox(newSectionBox)
      exitCurrentTool()
      trackEditSectionBox("rotate")
    },
    [sectionBox],
  )

  const onPreviewChangeTool = useCallback(
    (shape: Shape) => {
      if (!sectionBox) return
      const { matrix4: affineMatrix } = getRotationFromShape(shape)
      const newSectionBox = applyRotationToSectionBox(sectionBox.box, affineMatrix)
      setSectionBoxPreviewSignal(newSectionBox)
    },
    [sectionBox],
  )

  if (!initialShape) return null

  if (initialShape.vertices.length < 2) {
    return (
      <ShapeTool
        key="preciseRotate:initialLine"
        onComplete={onCompleteLine}
        isValid={isLineValid}
        onCancel={onCancel}
        config={DEFINE_REFERENCE_LINE}
        initialShape={initialShape}
      />
    )
  }

  return (
    <ShapeTool
      key="preciseRotate:complete"
      onComplete={onCompleteTool}
      isValid={(s) => s.vertices.length >= 2}
      onCancel={onCancel}
      initialShape={initialShape}
      config={COMPLETE_STEP}
      onPreviewChange={onPreviewChangeTool}
    />
  )
}
