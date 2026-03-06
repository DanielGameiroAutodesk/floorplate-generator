import { propertyPresets } from "src/integrations/draw/DrawAPI"
import type { Properties } from "@spacemakerai/element-types"
import { DrawLineOnGround } from "./DrawLineOnGround"
import type { FC } from "react"
import { useEffect, useState } from "preact/hooks"
import type { Shape } from "src/lib/three/Shape/types"
import use2DLineVisual from "src/integrations/tools-common/Drawing/shapeTool/visuals/use2DLineVisual"
import type { ShapeCreationMetaData } from "src/integrations/tools-common/Drawing/types"
import type { GroundPolygonMode } from "./DrawGroundPolygon"
import { explicitSignal } from "src/lib/signal"
import { useForceNoSelectedPaths } from "src/core/selection/selectionState"

export type CompleteCallback2DLine = (
  line?: { shape: Shape; close: boolean },
  additionalProperties?: { [key: string]: any },
  metadata?: ShapeCreationMetaData,
) => void

export type LinePreviewComponent = FC<{ shape?: Shape; props?: Properties }>

const NOOP = () => {}

type ToolCallbacks = {
  onComplete: CompleteCallback2DLine
  onUpdate: CompleteCallback2DLine
  currentCompleteState?: Parameters<CompleteCallback2DLine>
  PreviewComponent?: LinePreviewComponent
  properties?: Properties
  defaultMode?: GroundPolygonMode
}
export const [drawCallbacks2DLineSignal, setDrawCallbacks2DLineSignalValue] = explicitSignal<ToolCallbacks>({
  onComplete: NOOP,
  onUpdate: NOOP,
})

const onUpdate: CompleteCallback2DLine = (...ps: Parameters<CompleteCallback2DLine>) => {
  setDrawCallbacks2DLineSignalValue((callbacks) => ({
    ...callbacks,
    currentCompleteState: ps,
  }))
}

export function set2DLineCallback(
  onComplete: CompleteCallback2DLine,
  PreviewComponent?: LinePreviewComponent,
  defaultMode?: "rectangle" | "circle" | "pick" | "freeform",
) {
  setDrawCallbacks2DLineSignalValue({ onComplete, onUpdate, PreviewComponent, defaultMode })
}

export const DrawGroundLine = () => {
  const { onComplete, onUpdate, currentCompleteState, PreviewComponent } = drawCallbacks2DLineSignal.value

  useForceNoSelectedPaths()

  const [previewShape, setPreviewShape] = useState<Shape>()
  return (
    <>
      <DrawLineOnGround
        onComplete={onComplete}
        onUpdate={onUpdate}
        currentCompleteState={currentCompleteState}
        onPreviewChange={setPreviewShape}
        properties={propertyPresets.road}
        defaultMode={"freeform"}
      />
      {PreviewComponent && <PreviewComponent shape={previewShape} />}
    </>
  )
}

const DefaultLinePreview: LinePreviewComponent = ({ shape, props }) => {
  const [preview, setPreview] = useState<Shape>()

  useEffect(() => {
    setPreview(shape)
  }, [shape])

  use2DLineVisual(preview, props)
  return null
}

export function simpleLineElementRenderer(props: Properties): LinePreviewComponent {
  const Prev = ({ shape, additionalProperties }: { shape?: Shape; additionalProperties?: Properties }) => (
    <DefaultLinePreview shape={shape} props={{ ...props, ...additionalProperties }} />
  )
  return Prev
}
