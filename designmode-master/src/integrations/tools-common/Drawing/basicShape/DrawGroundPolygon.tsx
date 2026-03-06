import { atomFamily, useRecoilValue } from "recoil"
import { DrawCircleGroundPolygon } from "src/integrations/tools-common/Drawing/compoundShape/DrawCircle"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import {
  DRAW_PLANAR_POLYGON,
  DRAW_POLYGON_ON_TERRAIN,
} from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { DrawRectangle } from "src/integrations/tools-common/Drawing/compoundShape/DrawRectangle"
import { PickElement } from "./PickElement"
import { useCallback } from "preact/compat"
import type { Shape } from "src/lib/three/Shape/types"
import { ShapeUtils, SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON } from "src/lib/three/Shape/shapeUtils"
import type { CompleteCallback2D } from "./DrawPolygon"
import type { InternalPath } from "src/lib/element/path"

export type GroundPolygonMode = "rectangle" | "circle" | "pick" | "freeform"

export const GROUND_POLYGON_HOTKEYS = {
  RECTANGLE: "R",
  FREEFORM: "F",
  CIRCLE: "C",
  PICK: "P",
  LINE: "L",
}
export const previousToolMode = atomFamily<GroundPolygonMode | undefined, string>({
  key: "groundPolygonMode",
  default: undefined,
})

const DrawPolygon = ({
  onComplete,
  onPreviewChange,
  onUpdate,
  onTerrain = false,
}: {
  onComplete: CompleteCallback2D
  onUpdate: CompleteCallback2D
  onPreviewChange?: (shape: Shape) => void
  previewColor?: string
  onTerrain?: boolean
}) => {
  const complete = useCallback(
    (shape?: Shape) => {
      onComplete(shape) //We do this to prevent the un-pruned shape from being added as properties on the saved element.
    },
    [onComplete],
  )

  const cancel = useCallback(() => {
    onComplete()
  }, [onComplete])

  const update = useCallback(
    (shape?: Shape) => {
      if (!shape) return
      const closedCompleteState =
        shape &&
        ShapeUtils.closeEdgesAndCreateLoopFromShape({
          vertices: shape.vertices,
          edges: shape.edges,
          loops: [],
        })
      if (closedCompleteState && SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON(closedCompleteState)) {
        return onUpdate(closedCompleteState)
      }
    },
    [onUpdate],
  )

  return (
    <ShapeTool
      key="drawPolygon"
      onComplete={complete}
      onPreviewChange={onPreviewChange}
      onUpdate={update}
      config={onTerrain ? DRAW_POLYGON_ON_TERRAIN : DRAW_PLANAR_POLYGON}
      onCancel={cancel}
      isValid={SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON}
    />
  )
}

export default function DrawGroundPolygon({
  onComplete,
  currentCompleteState,
  onUpdate,
  onPreviewChange,
  onTerrain = false,
  activePreset,
  defaultMode,
}: {
  onComplete: CompleteCallback2D
  currentCompleteState?: Parameters<CompleteCallback2D>
  onUpdate: CompleteCallback2D
  onPreviewChange?: (shape: Shape) => void
  activePreset: string
  defaultMode: GroundPolygonMode
  onTerrain?: boolean
}) {
  const toolType = useRecoilValue(previousToolMode(activePreset)) || defaultMode

  const completeNotPick = useCallback(
    (shape?: Shape, additionalProperties?: { [key: string]: any }) => {
      if (toolType === "pick") {
        throw new Error("typeguard: Used completeNotPick when toolType was pick")
      }
      if (shape) {
        return onComplete(shape, additionalProperties, { method: toolType })
      }
      if (currentCompleteState) {
        return onComplete(...currentCompleteState)
      }
      return onComplete()
    },
    [currentCompleteState, onComplete, toolType],
  )

  const completePick = useCallback(
    (shape?: Shape, additionalProperties?: { [key: string]: any }, path?: InternalPath) => {
      if (!shape || !additionalProperties || !path) {
        onComplete()
        return
      }
      const metadata = { method: "pick" as const, pickedElement: path }
      onComplete(shape, additionalProperties, metadata)
    },
    [onComplete],
  )

  const onCancelPick = useCallback(() => {
    completePick()
  }, [completePick])

  switch (toolType) {
    case "circle":
      return (
        <DrawCircleGroundPolygon onComplete={completeNotPick} onPreviewChange={onPreviewChange} onTerrain={onTerrain} />
      )
    case "rectangle":
      return <DrawRectangle onComplete={completeNotPick} onTerrain={onTerrain} onPreviewChange={onPreviewChange} />
    case "pick":
      return (
        <PickElement onCancel={onCancelPick} onPolygonPicked={completePick} onExtrudedPolygonPicked={completePick} />
      )
    case "freeform":
    default:
      return (
        <DrawPolygon
          onComplete={completeNotPick}
          onUpdate={onUpdate}
          onPreviewChange={onPreviewChange}
          onTerrain={onTerrain}
        />
      )
  }
}
