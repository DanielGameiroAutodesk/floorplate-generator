import { useRecoilValue } from "recoil"
import type { GroundPolygonMode } from "./DrawGroundPolygon"
import { previousToolMode } from "./DrawGroundPolygon"
import { PickElement } from "./PickElement"
import { LineOnTerrainTool } from "./LineOnTerrainTool"
import type { Properties } from "@spacemakerai/element-types"
import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"
import { useCallback } from "preact/compat"
import type { Shape } from "src/lib/three/Shape/types"
import type { CompleteCallback2DLine } from "./DrawGroundLine"

export const DrawLineOnGround = ({
  onComplete,
  onUpdate,
  currentCompleteState,
  properties = basicElementPresets.generic2DLine,
  onPreviewChange,
  defaultMode,
}: {
  onComplete: CompleteCallback2DLine
  onUpdate: CompleteCallback2DLine
  currentCompleteState?: Parameters<CompleteCallback2DLine>
  onPreviewChange?: (shape: Shape, close: boolean) => void
  properties?: Properties
  previewColor?: string
  defaultMode: GroundPolygonMode
}) => {
  const preview = useCallback(
    (shape: Shape) => {
      if (!onPreviewChange) return

      onPreviewChange(shape, false)
    },
    [onPreviewChange],
  )

  const toolMode = useRecoilValue(previousToolMode("line")) || defaultMode

  const complete = useCallback(
    (shape?: Shape, additionalProperties?: { [key: string]: any }) => {
      if (toolMode === "pick") {
        throw new Error("typeguard")
      }
      if (shape) {
        return onComplete({ shape, close: false }, additionalProperties, { method: toolMode || "line" })
      }
      if (currentCompleteState) {
        return onComplete(...currentCompleteState)
      }
      return onComplete()
    },
    [currentCompleteState, onComplete, toolMode],
  )

  const update = useCallback(
    (shape: Shape) => {
      onUpdate({ shape, close: false })
    },
    [onUpdate],
  )

  const onCancel = useCallback(() => {
    return onComplete()
  }, [onComplete])

  switch (toolMode) {
    case "pick":
      return (
        <PickElement
          onCancel={onCancel}
          onLinePicked={(s, props, path) =>
            onComplete({ shape: s, close: false }, props, { method: "pick", pickedElement: path })
          }
          onExtrudedPolygonPicked={(s, props, path) =>
            onComplete({ shape: s, close: true }, props, { method: "pick", pickedElement: path })
          } //TODO: close the polygons before passing them up
          onPolygonPicked={(s, props, path) =>
            onComplete({ shape: s, close: true }, props, {
              method: "pick",
              pickedElement: path,
            })
          } //TODO: close the polygons before passing them up
        />
      )
    case "freeform":
    default:
      return (
        <LineOnTerrainTool onComplete={complete} onUpdate={update} properties={properties} onPreviewChange={preview} />
      )
  }
}
