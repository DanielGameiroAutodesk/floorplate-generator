import { ShapeVisual } from "./visuals/ShapeVisual"
import { DrawLine } from "./subtools/DrawLine/DrawLine"
import { Edit } from "./subtools/Edit/Edit"
import { useCallback, useMemo, useState } from "preact/compat"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import type { ShapeToolConfig } from "./ShapeToolConfig"
import { CreateToolMode } from "./ShapeToolConfig"
import { useSetRecoilState } from "recoil"
import {
  enableSnappingSignal,
  setCustomSnappingLinesSignalValue,
  setSelectedInternalSnappingLinesSignalValue,
  setSnapToExternalSignalValue,
} from "src/integrations/snapping/snappingPicker.state"
import { useEffect } from "preact/hooks"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import type { Guide } from "./subtools/CalculateMousePosition/CalculateMousePosition"
import type { EditedShape } from "src/lib/three/Shape/shapeUtils"
import { AT_LEAST_ONE_VERTEX, ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import type { Shape } from "src/lib/three/Shape/types"
import { useHotkey } from "src/core/hotkeys"
import { HotkeyCategory, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useIsImperial } from "src/lib/unitSettings"

type DrawToolProps = {
  isValid?: (shape: Shape) => boolean //Function use to check if the current shape is a valid output for the current use case
  onComplete: (shape: Shape, shapeWithChanges: EditedShape) => any //Called when tool finishes
  onCancel: () => any
  onPreviewChange?: (shape: Shape, shapeWithChanges: EditedShape) => any //Called every time a tool submode updates its state
  onUpdate?: (shape: Shape, shapeWithChanges?: EditedShape) => any //Called every time a piece is added to the shape
  initialShape?: Shape //Initial data loaded into tool
  config: ShapeToolConfig
  additionalSnappingLines?: SnappingLine[] //Customizable set of additional snapping lines
  initializeWithAdditionalSnappingLines?: boolean // Make additionalSnappingLines selected on init
  guide?: Guide
  discreteLength?: number
}

const EMPTY_SHAPE = {
  edges: [],
  vertices: [],
  faces: [],
  loops: [],
}
const NO_SNAPPING_LINES: SnappingLine[] = []

export const ShapeTool = ({
  isValid = AT_LEAST_ONE_VERTEX,
  onComplete,
  onCancel,
  initialShape = EMPTY_SHAPE,
  onPreviewChange,
  onUpdate,
  config,
  additionalSnappingLines = NO_SNAPPING_LINES,
  initializeWithAdditionalSnappingLines = false,
  guide,
  discreteLength,
}: DrawToolProps) => {
  const { toolMode, useContextualLines, onTerrain, snapToExternalShape } = config

  const useImperialUnits = useIsImperial()
  useEffect(() => {
    setSnapToExternalSignalValue(snapToExternalShape)
  }, [snapToExternalShape])

  const [shape, setShape] = useState<EditedShape>(initialShape)
  const prunedShape = useMemo(() => ShapeUtils.pruneEditedShape(shape), [shape])
  useEffect(() => {
    if (initializeWithAdditionalSnappingLines) {
      setSelectedInternalSnappingLinesSignalValue(additionalSnappingLines)
    }
    setCustomSnappingLinesSignalValue([...additionalSnappingLines])
  }, [additionalSnappingLines, initializeWithAdditionalSnappingLines])
  const completeValidShape = useCallback(() => {
    let pruned = ShapeUtils.pruneEditedShape(shape)
    if (isValid(pruned)) {
      onComplete(pruned, shape)
    }
  }, [isValid, onComplete, shape])

  const addToShape = useCallback(
    (added: EditedShape) => {
      const combined = ShapeUtils.addShape(shape, added)
      const pruned = ShapeUtils.pruneEditedShape(combined)
      setShape(combined)

      if (isValid(pruned)) {
        onUpdate && onUpdate(pruned, combined)
        onComplete(pruned, combined)
      }
    },
    [shape, isValid, onUpdate, onComplete],
  )

  const cancelHotkey = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.hotkeys.exitTool),
      keyCode: "Escape",
      editAccessRequired: false,
      callback: onCancel,
      category: HotkeyCategory.Tools,
    }
  }, [onCancel])

  useHotkey(cancelHotkey)
  const completeHotkey = useMemo((): HotkeyKeyRegistration => {
    return {
      description: (t) => t(($) => $.hotkeys.complete),
      keyCode: "Enter",
      editAccessRequired: true,
      callback: completeValidShape,
      category: HotkeyCategory.Tools,
    }
  }, [completeValidShape])
  useHotkey(completeHotkey)

  const dblclick = useCallback(() => {
    if (toolMode === CreateToolMode.Edit) {
      completeValidShape()
    }
    return Propagate.NO
  }, [toolMode, completeValidShape])

  useEventHandler("dblclick", dblclick, Priority.TOOL)

  const replaceShape = useCallback(
    (newShape: EditedShape) => {
      const pruned = ShapeUtils.pruneEditedShape(newShape)
      setShape(newShape)
      isValid && isValid(pruned) && onUpdate && onUpdate(pruned, newShape)
    },
    [onUpdate, isValid],
  )

  const valid = useMemo(() => isValid(prunedShape), [isValid, prunedShape])

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    if (config.guideText) {
      setGuideText(() => config.guideText)
      return () => setGuideText(() => () => "")
    }
  }, [config.guideText, setGuideText])

  return (
    <>
      {toolMode === CreateToolMode.Edit && (
        <>
          <Edit
            shape={prunedShape}
            onComplete={replaceShape}
            onChange={onPreviewChange}
            isValid={isValid}
            useImperialUnits={useImperialUnits}
            config={config}
            guide={guide}
            enableSnappingPicker={useContextualLines && enableSnappingSignal.value}
            discreteLength={discreteLength}
          />
        </>
      )}

      {toolMode === CreateToolMode.DrawClosedPolygon && (
        <DrawLine
          closed={true}
          placedShape={prunedShape}
          onComplete={addToShape}
          onUpdate={onUpdate}
          onCancel={onCancel}
          useImperialUnits={useImperialUnits}
          onPreviewChange={onPreviewChange}
          toolConfig={config}
          singleLineSegment={false}
          guide={guide}
          enableSnappingPicker={useContextualLines && enableSnappingSignal.value}
        />
      )}
      {toolMode === CreateToolMode.DrawLine && (
        <DrawLine
          closed={false}
          placedShape={prunedShape}
          onComplete={addToShape}
          onUpdate={onUpdate}
          onCancel={onCancel}
          useImperialUnits={useImperialUnits}
          onPreviewChange={onPreviewChange}
          toolConfig={config}
          singleLineSegment={false}
          guide={guide}
          enableSnappingPicker={useContextualLines && enableSnappingSignal.value}
        />
      )}
      {toolMode === CreateToolMode.DrawLineSegment && (
        <DrawLine
          closed={false}
          placedShape={prunedShape}
          onComplete={addToShape}
          onUpdate={onUpdate}
          onCancel={onCancel}
          useImperialUnits={useImperialUnits}
          onPreviewChange={onPreviewChange}
          toolConfig={config}
          singleLineSegment={true}
          guide={guide}
          enableSnappingPicker={useContextualLines && enableSnappingSignal.value}
        />
      )}

      {toolMode !== CreateToolMode.Edit && (
        <ShapeVisual shape={prunedShape} valid={valid} onTerrain={onTerrain} useImperialUnits={useImperialUnits} />
      )}
    </>
  )
}
