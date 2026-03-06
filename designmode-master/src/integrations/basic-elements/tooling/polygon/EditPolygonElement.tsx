import { useCallback, useMemo, useState } from "preact/hooks"
import { CreateToolMode, ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Feature } from "geojson"
import type { InternalPath } from "src/lib/element/path"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { Shape } from "src/lib/three/Shape/types"
import {
  polygonGeometryElevatedToShape,
  polygonGeometryToShape,
  shapeToPolygonFeature,
  SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON,
} from "src/lib/three/Shape/shapeUtils"
import { AnalyticsUtils, Analytics } from "src/core/analytics"
import type { FormaElement } from "@spacemakerai/element-types"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import Edit2DPolygonVisuals from "./Edit2DPolygonVisuals"
import Edit25DPolygonVisuals from "./Edit25DPolygonVisuals"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool } from "src/core/toolsState"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const shapeConfig2D = {
  toolMode: CreateToolMode.Edit,
  moveModes: [ShapeToolMoveMode.TERRAIN],
  onTerrain: true,
  singleShape: true,
  linkVerticesVertically: false,
  requireAlwaysValid: false,
  useContextualLines: true,
  snapToExternalShape: true,
}

const shapeConfig25D = {
  toolMode: CreateToolMode.Edit,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  onTerrain: false,
  singleShape: false,
  linkVerticesVertically: false,
  requireAlwaysValid: false,
  useContextualLines: true,
  snapToExternalShape: true,
}

export default function EditPolygonElement({
  path,
  element,
  geojson,
  dimension,
}: {
  path: InternalPath
  element: FormaElement
  geojson: Feature
  dimension: "2D" | "2.5D"
}) {
  const { apply } = useActionAPI()
  const node = elementState.currentSnapshot.value.getNodeOrThrow(path)
  const worldMatrix = node.globalMatrix
  const terrain = terrainSignal.value

  const initialShape = useMemo(() => {
    if (geojson.geometry.type === "Polygon" && dimension === "2.5D")
      return polygonGeometryElevatedToShape(geojson.geometry, worldMatrix, geojson.properties?.elevation)
    if (geojson.geometry.type === "Polygon" && dimension === "2D")
      return polygonGeometryToShape(geojson.geometry, worldMatrix, terrain.elevationAt)

    console.error("EditPolygonElement: invalid geojson type, failed to create initial shape")
  }, [dimension, geojson, worldMatrix, terrain])

  const [previewShape, setPreviewShape] = useState<Shape | undefined>(initialShape)

  const onComplete = useCallback(
    (polygonShape: Shape) => {
      const adjust = worldMatrix.clone().invert()
      polygonShape.vertices = polygonShape.vertices.map((v) => v.clone().applyMatrix4(adjust))

      const feature = shapeToPolygonFeature(polygonShape)
      feature.properties = { ...geojson.properties, ...feature.properties }

      const actions = BasicElementAPI.basicActionsToCoreActions([BasicElementAPI.updateFeature(path, feature)])

      apply(`Element - Edit Polygon ${dimension}`, actions, {
        numElements: 1,
        eventType: "update",
        elementCategory: element.properties?.category ?? "",
        tool: `editPolygon${dimension}`,
        inScenario: AnalyticsUtils.trackedInScenarioFlag([node.isInBase]),
      })
      Analytics.trackAddElement(
        EventName.Add,
        { feature_category: FeatureCategory.DesignTool, feature: "draw", object_type: "element" },
        { category: element.properties?.category ?? "unknown", shape_type: "polygon" },
      )
      exitCurrentTool()
    },
    [worldMatrix, geojson.properties, path, apply, dimension, element.properties?.category, node],
  )

  const onPreviewChange = useCallback((shape: Shape) => {
    if (!SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON(shape)) return
    setPreviewShape(shape)
  }, [])

  const onCancel = useCallback(() => {
    if (previewShape) {
      return onComplete(previewShape)
    }
    exitCurrentTool()
  }, [onComplete, previewShape])

  return (
    <>
      {dimension === "2D" && <Edit2DPolygonVisuals shape={previewShape} element={element} path={path} />}
      {dimension === "2.5D" && (
        <Edit25DPolygonVisuals shape={previewShape} element={element} path={path} height={geojson.properties?.height} />
      )}
      <ShapeTool
        onComplete={onComplete}
        onPreviewChange={onPreviewChange}
        onCancel={onCancel}
        isValid={SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON}
        initialShape={initialShape}
        config={dimension === "2D" ? shapeConfig2D : shapeConfig25D}
      />
    </>
  )
}
