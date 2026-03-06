import { useCallback, useMemo, useState } from "preact/hooks"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import { CreateToolMode, ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Feature } from "geojson"
import type { InternalPath } from "src/lib/element/path"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { Shape } from "src/lib/three/Shape/types"
import { AT_LEAST_TWO_VERTICES, lineStringGeometryToShape, shapeToBasicLine } from "src/lib/three/Shape/shapeUtils"
import { AnalyticsUtils } from "src/core/analytics"
import type { FormaElement } from "@spacemakerai/element-types"
import Edit2DLineVisuals from "./Edit2DLineVisuals"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool } from "src/core/toolsState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const baseConfig = {
  toolMode: CreateToolMode.Edit,
  moveModes: [ShapeToolMoveMode.TERRAIN],
  onTerrain: true,
  singleShape: true,
  linkVerticesVertically: false,
  requireAlwaysValid: false,
  useContextualLines: true,
  snapToExternalShape: true,
}

export default function Edit2DLineElement({
  path,
  element,
  geojson,
}: {
  path: InternalPath
  element: FormaElement
  geojson: Feature
}) {
  const { elevationAt } = terrainSignal.value
  const { apply } = useActionAPI()
  const node = elementState.currentSnapshot.value.getNodeOrThrow(path)
  const worldMatrix = node.globalMatrix

  const initialShape = useMemo(() => {
    if (geojson.geometry.type === "LineString")
      return lineStringGeometryToShape(geojson.geometry, worldMatrix, elevationAt)

    console.error("Edit2DLineElement: invalid geojson type, failed to create initial shape")
  }, [geojson, elevationAt, worldMatrix])

  const onComplete = useCallback(
    (shape: Shape) => {
      const adjust = worldMatrix.clone().invert()
      shape.vertices = shape.vertices.map((v) => v.clone().applyMatrix4(adjust))
      const lineWidth = geojson.properties?.lineWidth

      const properties: { lineWidth?: number } = {}
      if (lineWidth) properties["lineWidth"] = lineWidth

      const feature = shapeToBasicLine(shape, properties)

      const actions = BasicElementAPI.basicActionsToCoreActions([BasicElementAPI.updateFeature(path, feature)])

      apply("Element - Edit Line 2D", actions, {
        numElements: 1,
        eventType: "update",
        elementCategory: element.properties?.category ?? "",
        tool: "edit line 2D",
        inScenario: AnalyticsUtils.trackedInScenarioFlag([node.isInBase]),
      })
      exitCurrentTool()
    },
    [worldMatrix, geojson.properties?.lineWidth, path, apply, element.properties?.category, node],
  )

  const [previewShape, setPreviewShape] = useState<Shape | undefined>(initialShape)
  const onPreviewChange = useCallback((shape: Shape) => {
    if (!AT_LEAST_TWO_VERTICES(shape)) return
    setPreviewShape(shape)
  }, [])

  const onCancel = useCallback(() => {
    if (previewShape) return onComplete(previewShape)
    exitCurrentTool()
  }, [onComplete, previewShape])

  return (
    <>
      <Edit2DLineVisuals element={element} path={path} geojson={geojson} shape={previewShape} />
      <ShapeTool
        onComplete={onComplete}
        onPreviewChange={onPreviewChange}
        onCancel={onCancel}
        isValid={AT_LEAST_TWO_VERTICES}
        initialShape={initialShape}
        config={baseConfig}
      />
    </>
  )
}
