import type { Properties } from "@spacemakerai/element-types"
import type { GroundPolygonMode } from "./DrawGroundPolygon"
import DrawGroundPolygon from "./DrawGroundPolygon"
import { useCallback, useEffect, useState } from "preact/hooks"
import { ShapeUtils, SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON } from "src/lib/three/Shape/shapeUtils"
import use2DPolygonVisual from "src/integrations/tools-common/Drawing/shapeTool/visuals/use2DPolygonVisual"
import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"
import type { FC } from "react"
import type { Shape } from "src/lib/three/Shape/types"
import { samePoint } from "src/lib/three/geometryUtils"
import type { ShapeCreationMetaData } from "src/integrations/tools-common/Drawing/types"
import { explicitSignal } from "src/lib/signal"
import { useForceNoSelectedPaths } from "src/core/selection/selectionState"

export type CompleteCallback2D = (
  shape?: Shape,
  additionalProperties?: { [key: string]: any },
  metadata?: ShapeCreationMetaData,
) => void

export type PolygonPreviewComponent = FC<{ shape: Shape; additionalProperties?: Properties }>

const NOOP = () => {}

type ToolCallbacks = {
  onComplete: CompleteCallback2D
  onUpdate: CompleteCallback2D
  currentCompleteState?: Parameters<CompleteCallback2D>
  PreviewComponent?: PolygonPreviewComponent
  defaultMode?: GroundPolygonMode
}

export const [drawCallbacks2DSignal, setDrawCallbacks2DSignalValue] = explicitSignal<ToolCallbacks>({
  onComplete: NOOP,
  onUpdate: NOOP,
})

const onUpdate: CompleteCallback2D = (...ps: Parameters<CompleteCallback2D>) => {
  setDrawCallbacks2DSignalValue((callbacks) => ({
    ...callbacks,
    currentCompleteState: ps,
  }))
}

export function set2DCallback(
  onComplete: CompleteCallback2D,
  PreviewComponent?: PolygonPreviewComponent,
  defaultMode?: "rectangle" | "circle" | "pick" | "freeform",
) {
  setDrawCallbacks2DSignalValue({ onComplete, onUpdate, PreviewComponent, defaultMode })
}

export const DrawPolygon = () => {
  const { onComplete, onUpdate, currentCompleteState, PreviewComponent, defaultMode } = drawCallbacks2DSignal.value

  useForceNoSelectedPaths()

  const [shape, setShape] = useState<Shape | undefined>(undefined)
  return (
    <>
      <DrawGroundPolygon
        onComplete={onComplete}
        currentCompleteState={currentCompleteState}
        onUpdate={onUpdate}
        onPreviewChange={setShape}
        onTerrain={true}
        activePreset={"surface"}
        defaultMode={defaultMode ?? "freeform"}
      />
      {shape && PreviewComponent && <PreviewComponent shape={shape} />}
    </>
  )
}
export const simplePolygonElementRenderer = (props: Properties): PolygonPreviewComponent => {
  const Prev = ({ shape, additionalProperties }: { shape: Shape; additionalProperties?: Properties }) => (
    <PolygonPreview shape={shape} additionalProperties={{ ...props, ...additionalProperties }} />
  )
  return Prev
}

const PolygonPreview = ({ shape, additionalProperties }: { shape: Shape; additionalProperties?: Properties }) => {
  const [_shape, setShape] = useState<Shape>()

  const handlePreview = useCallback((s: Shape) => {
    if (s.vertices.length < 3) return
    const isLastVertexSameAsFirst = samePoint(s.vertices[0], s.vertices[s.vertices.length - 1])
    let closedShape = s
    if (isLastVertexSameAsFirst) {
      closedShape = removeDuplicateLastVertex(s)
    }
    closedShape = ShapeUtils.closeEdgesAndCreateLoopFromShape(closedShape)

    if (!isValid(closedShape)) {
      return
    }
    setShape(closedShape)
  }, [])

  useEffect(() => {
    handlePreview(shape)
  }, [shape, handlePreview])

  use2DPolygonVisual(_shape, additionalProperties ?? basicElementPresets.generic2D)
  return null
}
const isValid = SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON

// replaces last vertex with vertex if they are the same point
// (i.e. when user hovers over first vertex to close the shape)
function removeDuplicateLastVertex(s: Shape) {
  const lastIndex = s.vertices.length - 1
  return {
    ...s,
    vertices: s.vertices.slice(0, lastIndex),
    edges: s.edges.map(([a, b]) => [a === lastIndex ? 0 : a, b === lastIndex ? 0 : b] as [number, number]),
  }
}
