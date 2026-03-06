import type { Feature, LineString } from "geojson"
import { useCallback, useRef, useState } from "preact/hooks"
import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { isDefined } from "src/lib/array"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { Shape } from "src/lib/three/Shape/types"
import { raycast } from "src/core/terrain/2d-raytracer"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import type { ShapeToolConfig } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { CreateToolMode, ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { useReadonlySignal } from "src/lib/signal"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const createLineStringConfig: ShapeToolConfig = {
  toolMode: CreateToolMode.DrawLine,
  moveModes: [ShapeToolMoveMode.TERRAIN],
  requireAlwaysValid: true,
  onTerrain: true,
  useContextualLines: true,
  linkVerticesVertically: false,
  snapToExternalShape: true,
}

const editLineStringConfig: ShapeToolConfig = {
  ...createLineStringConfig,
  toolMode: CreateToolMode.Edit,
}

function createLineStringFeature(shape: Shape, transform: Matrix4): Feature<LineString> | undefined {
  const adjust = transform.clone().invert()
  const coordinates = ShapeUtils.connectedVerticesOfShape(shape)
    .filter(isDefined)
    .map((v) => v.clone().applyMatrix4(adjust))
    .map(({ x, y }) => [x, y])

  if (coordinates.length < 2) {
    return undefined
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  }
}

export function AT_LEAST_TWO_DISTINCT_VERTICES(shape: Shape): boolean {
  // designmode crashes if it tries to render a LineString where two
  // points have the same coordinate, so avoiding this case for now.
  return shape.vertices.length >= 2 && shape.vertices[0].distanceTo(shape.vertices[1]) > 0
}

function lineStringFeatureToShape(
  feature: Feature<LineString>,
  terrainSampler: TerrainSamplerData,
  transform: Matrix4,
): Shape {
  const coordinates = feature.geometry.coordinates
  return {
    vertices: coordinates
      .map(([x, y]) => new Vector3(x, y, 0).applyMatrix4(transform))
      .map((v) => v.setZ(raycast(v.x, v.y, terrainSampler))),
    edges: coordinates.slice(0, -1).map((_, i) => [i, (i + 1) % coordinates.length] as [number, number]),
    loops: [],
  }
}

export type RequestLineStringFn = (params: {
  initialValue: LineString | undefined
  onPreview(value: LineString): void
  onComplete(value: LineString): void
  onCancel: () => void
}) => void

export function useDrawTool(transform: Matrix4) {
  const shapeToolKeySeq = useRef(0)
  const [shapeTool, setShapeTool] = useState<JSX.Element>()
  const transformSignal = useReadonlySignal(transform)

  const requestLineString = useCallback<RequestLineStringFn>(
    (input) => {
      const key = String(shapeToolKeySeq.current++)

      const initialShape = input.initialValue
        ? lineStringFeatureToShape(
            { type: "Feature", properties: {}, geometry: input.initialValue },
            terrainSignal.peek().terrainSamplerData,
            transformSignal.peek(),
          )
        : undefined

      const component = (
        <ShapeTool
          // Using a different key to force a new component
          // so that state for "initialShape" is reset.
          key={key}
          onComplete={(shape) => {
            if (AT_LEAST_TWO_DISTINCT_VERTICES(shape)) {
              const feature = createLineStringFeature(shape, transformSignal.peek())!
              input.onComplete(feature.geometry)
            }
          }}
          onPreviewChange={(shape) => {
            if (AT_LEAST_TWO_DISTINCT_VERTICES(shape)) {
              const feature = createLineStringFeature(shape, transformSignal.peek())
              if (feature) {
                input.onPreview(feature.geometry)
              }
            }
          }}
          config={initialShape ? editLineStringConfig : createLineStringConfig}
          onCancel={input.onCancel}
          isValid={AT_LEAST_TWO_DISTINCT_VERTICES}
          initialShape={initialShape}
        />
      )

      setShapeTool(component)
    },
    [transformSignal],
  )

  return { shapeTool, requestLineString }
}
