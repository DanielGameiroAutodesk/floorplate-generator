import { useCallback, useState } from "preact/compat"
import type { ShapeToolConfig } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { CreateToolMode, ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import useIs2D from "src/core/three/useIs2d"
import type { GroundPolygonMode } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import DrawGroundPolygon from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import type { Properties } from "@spacemakerai/element-types"
import type { FC } from "react"
import { simpleVolume25DElementRenderer } from "./DefaultPreviews"
import type { Shape } from "src/lib/three/Shape/types"
import { DEFAULT_COLOR_3D } from "src/lib/three/defaultRenderingProperties"
import type { ShapeCreationMetaData } from "src/integrations/tools-common/Drawing/types"
import type { CompleteCallback2D } from "src/integrations/tools-common/Drawing/basicShape/DrawPolygon"
import { explicitSignal } from "src/lib/signal"
import { useForceNoSelectedPaths } from "src/core/selection/selectionState"

type Volume25D = {
  shape: Shape
  height: number
}

export type CompleteCallback25D = (
  volume25D?: Volume25D,
  additionalProperties?: { [key: string]: any },
  metadata?: ShapeCreationMetaData,
) => void

export type Volume25DPreviewComponent = FC<{ shape?: Shape; height?: number; additionalProperties?: Properties }>
const NOOP = () => {}

type ToolCallbacks = {
  onComplete: CompleteCallback25D
  onUpdate: CompleteCallback2D
  currentPolygonState?: Parameters<CompleteCallback2D>
  PreviewComponent?: Volume25DPreviewComponent
  defaultMode?: GroundPolygonMode
  discreteHeight?: number
}

const [drawCallbacks25DSignal, setDrawCallbacks25DSignalValue] = explicitSignal<ToolCallbacks>({
  onComplete: NOOP,
  onUpdate: NOOP,
})

export { drawCallbacks25DSignal }

const onUpdate: CompleteCallback2D = (...ps: Parameters<CompleteCallback2D>) => {
  setDrawCallbacks25DSignalValue((callbacks) => ({
    ...callbacks,
    currentPolygonState: ps,
  }))
}

export function set25DCallback(
  onComplete: CompleteCallback25D,
  PreviewComponent?: Volume25DPreviewComponent,
  defaultMode?: "rectangle" | "circle" | "pick" | "freeform",
  discreteHeight?: number,
) {
  setDrawCallbacks25DSignalValue({ onComplete, onUpdate, PreviewComponent, defaultMode, discreteHeight })
}

export enum Step {
  DrawPolygon = 0,
  DrawHeight = 1,
}

const EditVerticalLineSegment: ShapeToolConfig = {
  moveModes: [ShapeToolMoveMode.VERTICAL],
  activeVertices: [1],
  useContextualLines: false,
  toolMode: CreateToolMode.Edit,
  linkVerticesVertically: false,
  onTerrain: false,
  requireAlwaysValid: false,
  snapToExternalShape: true,
  ignoreTerrainSnappingLines: true,
}

const DEFAULT_HEIGHT = 12
const DefaultPreview = simpleVolume25DElementRenderer({
  color: DEFAULT_COLOR_3D,
})

export function Draw25DBox() {
  const [creationMetadata, setCreationMetadata] = useState<ShapeCreationMetaData>()
  const { onComplete, onUpdate, currentPolygonState, PreviewComponent, defaultMode, discreteHeight } =
    drawCallbacks25DSignal.value
  const [step, setStep] = useState(Step.DrawPolygon)
  const [footPrint, setFootPrint] = useState<Shape>()
  const [heightInitialShape, setHeightInitialShape] = useState<Shape>()
  const [height, setHeight] = useState<number | undefined>()
  const is2D = useIs2D()

  const [additionalProperties, setAdditionalProperties] = useState<any>()

  useForceNoSelectedPaths()

  const reset = useCallback(() => {
    setStep(Step.DrawPolygon)
    setFootPrint(undefined)
    setHeightInitialShape(undefined)
    setCreationMetadata(undefined)
    setAdditionalProperties(undefined)
    setHeight(undefined)
  }, [])

  const commitPolygon = useCallback(
    (shape?: Shape, additionalProperties?: { [key: string]: any }, metadata?: ShapeCreationMetaData) => {
      if (!shape) {
        return onComplete()
      }
      setAdditionalProperties(additionalProperties)
      setFootPrint(shape)
      const minZ = shape.vertices.reduce((min, cur) => Math.min(min, cur.z), Number.MAX_SAFE_INTEGER)
      setHeightInitialShape({
        vertices: [shape.vertices[0].clone().setZ(minZ), shape.vertices[0]],
        edges: [[0, 1]],
        loops: [],
      })
      if (is2D) {
        onComplete({ shape, height: DEFAULT_HEIGHT }, additionalProperties, metadata)
        reset()
      } else {
        setCreationMetadata(metadata)
        setStep(Step.DrawHeight)
      }
    },
    [is2D, onComplete, reset],
  )

  const commitBox25d = useCallback(() => {
    if (footPrint && height) {
      onComplete({ shape: footPrint, height }, additionalProperties, creationMetadata)
      reset()
    }
  }, [footPrint, height, onComplete, reset, additionalProperties, creationMetadata])

  const updatePreview = useCallback((shape: Shape) => {
    setHeight(Math.max(0, lineHeightOfShape(shape)))
  }, [])

  const Preview = PreviewComponent ?? DefaultPreview

  const updateFootprintPreview = useCallback((shape: Shape) => {
    return shape.vertices.length >= 3 && setFootPrint(shape)
  }, [])

  let tool =
    step === Step.DrawPolygon ? (
      <DrawGroundPolygon
        onComplete={commitPolygon}
        onUpdate={onUpdate}
        currentCompleteState={currentPolygonState}
        onTerrain={false}
        activePreset={"volume"}
        onPreviewChange={updateFootprintPreview}
        defaultMode={defaultMode ?? "freeform"}
      />
    ) : (
      <ShapeTool
        key="drawHeight"
        initialShape={heightInitialShape}
        onComplete={commitBox25d}
        onUpdate={commitBox25d}
        onPreviewChange={updatePreview}
        onCancel={reset}
        config={EditVerticalLineSegment}
        isValid={isPositiveVerticalLine}
        discreteLength={discreteHeight}
      />
    )
  return (
    <>
      {tool}
      <Preview shape={footPrint} height={height} />
    </>
  )
}

function isPositiveVerticalLine(shape: Shape): boolean {
  if (shape.vertices.length !== 2) return false

  return lineHeightOfShape(shape) > 0
}

function lineHeightOfShape(shape: Shape): number {
  return shape.vertices[1].z - shape.vertices[0].z
}
