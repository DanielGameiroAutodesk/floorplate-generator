import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import { useCallback, useEffect, useState } from "preact/compat"
import { DRAW_LINE_ON_TERRAIN } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { splitPolygon } from "./logic/PolygonSplitUtils"
import { useSelectedPathInfoState } from "src/core/selection/selected-basic-features"
import type { Matrix4, Object3D, Vector2Like } from "three"
import { Color, DoubleSide, Group, Vector3 } from "three"
import type { Position } from "geojson"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import type { Box25D } from "./BoxVisual25D"
import { Box25DVisual } from "./BoxVisual25D"
import { HiddenPaths } from "src/core/hidden"
import { isLineStringIntersectingOrHasLoopbacks2D } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { contextRootSignal } from "src/core/selection/selectionState"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { groupFrom2dRenderables } from "src/integrations/renderables/groupFrom2dRenderables"
import { buildRenderablesFromGeojson } from "src/integrations/renderables/buildRenderablesFromGeojson"
import { colors } from "src/lib/colors"
import { captureLogAndToast } from "src/core/sentry"
import type { Action } from "src/core/legacy-actions"
import type { BasicFeature, ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { isExtrudedPolygon } from "src/lib/geometry/geometryTypes"
import type { InternalPath } from "src/lib/element/path"
import { mergePath } from "src/lib/element/path"
import { newChildKey } from "src/lib/element/urn"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { Shape } from "src/lib/three/Shape/types"
import { AnalyticsUtils } from "src/core/analytics"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { DEFAULT_COLOR_2D, DEFAULT_COLOR_3D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"
import type { BasicCreateAction } from "src/integrations/basic-elements/api/types"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"
import { useSnappingLines } from "src/integrations/snapping/useSnappingLines"
import { exitCurrentTool } from "src/core/toolsState"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useIsImperial } from "src/lib/unitSettings"

type Block = {
  coordinates: number[][][]
  elevation: number
  height: number
}

function buildLineSegmentsBufferFast(blocks: Block[]): Float32Array {
  let numPoints = 0
  blocks.forEach((b) => {
    b.coordinates.forEach((ring) => {
      numPoints += ring.length * 6 // 2 pr floor, roof, vertical
    })
  })

  const buffer = new Float32Array(numPoints * 3)
  let idx = 0
  blocks.forEach((u) => {
    u.coordinates.forEach((ring) => {
      ring.forEach((p, i, l) => {
        // vertical
        buffer[idx++] = p[0]
        buffer[idx++] = p[1]
        buffer[idx++] = u.elevation
        buffer[idx++] = p[0]
        buffer[idx++] = p[1]
        buffer[idx++] = u.elevation + u.height
        // floor
        buffer[idx++] = p[0]
        buffer[idx++] = p[1]
        buffer[idx++] = u.elevation
        buffer[idx++] = l[(i + 1) % l.length][0]
        buffer[idx++] = l[(i + 1) % l.length][1]
        buffer[idx++] = u.elevation
        // roof
        buffer[idx++] = p[0]
        buffer[idx++] = p[1]
        buffer[idx++] = u.elevation + u.height
        buffer[idx++] = l[(i + 1) % l.length][0]
        buffer[idx++] = l[(i + 1) % l.length][1]
        buffer[idx++] = u.elevation + u.height
      })
    })
  })
  return buffer
}

function split2DPolygon(originalShape: BasicFeature, worldMatrix: Matrix4 | undefined, splittingLine: Vector3[]) {
  let geometry = originalShape.geometry
  let coords: Position[] = []
  switch (geometry.type) {
    case "Polygon":
      coords = geometry.coordinates[0]
      break
  }
  const polygon = coords.map(([x, y]) => {
    let v = new Vector3(x, y)
    if (worldMatrix) {
      v.applyMatrix4(worldMatrix)
    }
    return v
  })

  try {
    return splitPolygon(polygon, splittingLine)
  } catch (e) {
    captureLogAndToast(e, "Split failed")
    return [polygon]
  }
}

function splitExtrudedPolygon(
  originalShape: ExtrudedPolygonFeature,
  worldMatrix: Matrix4 | undefined,
  splittingLine: Vector3[],
) {
  let split = split2DPolygon(originalShape, worldMatrix, splittingLine)
  const properties = originalShape.properties
  let elevation = properties.elevation
  if (worldMatrix) {
    elevation += new Vector3().applyMatrix4(worldMatrix).z
  }

  const height = properties.height
  const boxes = split.map((vertices) => {
    return {
      coordinates: [vertices.map(({ x, y }) => [x, y])],
      height,
      elevation,
    }
  })

  return boxes
}

const lineMaterial = new LineMaterial({
  color: new Color(colors.gray10).getHex(),
  linewidth: 1,
  resolution: screenResolutionVector,
  name: "Parking Outline",
})
export const SplitTool = () => {
  const isImperial = useIsImperial()

  const selectedInfo = useSelectedPathInfoState()

  const [preview, setPreview] = useState<Object3D>()
  const [preview2D, setPreview2D] = useState<Object3D>()
  const [boxesPerPath, setBoxesPerPath] = useState<{ [path: InternalPath]: Box25D[] }>({})
  const [polysPerPath, setPolysPerPath] = useState<{ [path: InternalPath]: Vector2Like[][] }>({})
  useObjectLifecycle(preview)
  useObjectLifecycle(preview2D, true, sceneManager.overlay.scene)

  const onPreview = useCallback(
    (shape: Shape) => {
      const preview = new Group()
      const preview2D = new Group()
      const results: { [path: InternalPath]: Box25D[] } = {}
      const results2D: { [path: InternalPath]: Vector2Like[][] } = {}
      let splittingLine = shape.vertices
      if (isLineStringIntersectingOrHasLoopbacks2D(splittingLine)) {
        return
      }

      selectedInfo.forEach((splitElement) => {
        let geojson = splitElement.geojson
        if (isExtrudedPolygon(geojson)) {
          const boxes: Box25D[] = splitExtrudedPolygon(geojson, splitElement.worldMatrix, splittingLine)

          const visual = new Box25DVisual(
            boxes,
            splitElement.element.properties?.color ?? DEFAULT_COLOR_3D,
            0.5,
            DoubleSide,
          )
          const lines = new LineSegmentsGeometry().setPositions(buildLineSegmentsBufferFast(boxes))
          visual.add(new LineSegments2(lines, lineMaterial))
          results[splitElement.path] = boxes
          preview.add(visual)
        } else {
          const polys = split2DPolygon(geojson as ExtrudedPolygonFeature, splitElement.worldMatrix, splittingLine)
          polys.forEach((poly) => {
            const feature: BasicFeature = {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [poly.map((v) => [v.x, v.y])],
              },
              properties: {},
            }

            const renderables = buildRenderablesFromGeojson(
              feature,
              splitElement.element.properties?.category ?? "generic",
              undefined,
              splitElement.element.properties?.color ?? DEFAULT_COLOR_2D,
              splitElement.element.properties?.opacity ?? DEFAULT_OPACITY_2D,
              splitElement.path,
              undefined,
              isImperial,
              {
                ...splitElement.element.properties,
                stroke: {
                  color: colors.blue60, // hack to mimick blue outlines on 2d split shapes
                },
              },
            )

            const visual = groupFrom2dRenderables(renderables)

            preview2D.add(visual)
          })
          results2D[splitElement.path] = polys
        }
      })
      setBoxesPerPath(results)
      setPolysPerPath(results2D)
      setPreview(preview)
      setPreview2D(preview2D)
    },
    [isImperial, selectedInfo],
  )

  useEffect(() => {
    HiddenPaths.setHiddenPathsSignalValue(new Set(selectedInfo.map((i) => i.path)))
    return () => {
      HiddenPaths.resetHiddenPaths()
    }
  }, [selectedInfo])

  const contextRoot = contextRootSignal.value

  const actionAPI = useActionAPI()
  const onComplete = useCallback(() => {
    let basicCreateActions: BasicCreateAction[] = []
    let deleteActions: Action<"delete">[] = []

    const categories: (string | undefined)[] = []

    for (let [path, boxes] of Object.entries(boxesPerPath)) {
      if (boxes.length <= 1) return []
      const currentSelectedInfo = selectedInfo.find((i) => i.path === path)
      const is3d = currentSelectedInfo?.geojson && isExtrudedPolygon(currentSelectedInfo?.geojson)
      const color = (currentSelectedInfo?.element.properties?.color ?? is3d) ? DEFAULT_COLOR_3D : DEFAULT_COLOR_2D
      const opacity = (currentSelectedInfo?.element.properties?.opacity ?? is3d) ? 1.0 : DEFAULT_OPACITY_2D
      const properties = currentSelectedInfo?.element.properties
      categories.push(properties?.category)

      for (let box of boxes) {
        basicCreateActions.push({
          type: "basic-create",
          parentPath: contextRoot,
          child: { key: newChildKey() },
          feature: {
            type: "Feature",
            properties: {
              height: box.height,
              elevation: box.elevation,
            },
            geometry: {
              type: "Polygon",
              coordinates: box.coordinates,
            },
          },
          properties: { ...properties, color, opacity },
        })
      }
      deleteActions.push({ type: "delete", path })
    }
    for (let [path, polygons] of Object.entries(polysPerPath)) {
      if (polygons.length <= 1) return []
      const currentSelectedInfo = selectedInfo.find((i) => i.path === path)
      const properties = currentSelectedInfo?.element.properties as BasicElementProperties
      categories.push(properties?.category)

      for (let polygon of polygons) {
        basicCreateActions.push({
          type: "basic-create",
          parentPath: contextRoot,
          child: { key: newChildKey() },
          feature: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [polygon.map((v) => [v.x, v.y])],
            },
          },
          properties: { ...properties },
        })
      }
      deleteActions.push({ type: "delete", path })
    }
    exitCurrentTool()

    actionAPI.apply(
      "Split",
      [...BasicElementAPI.basicActionsToCoreActions(basicCreateActions), ...deleteActions],
      {
        tool: "split",
        elementCategory: AnalyticsUtils.trackedElementCategory(categories),
        numElements: selectedInfo.length,
        eventType: "replace",
      },
      new Set(basicCreateActions.map((a) => mergePath(a.parentPath, a.child.key))),
    )
  }, [actionAPI, selectedInfo, boxesPerPath, contextRoot, polysPerPath])

  const onCancel = useCallback(() => {
    exitCurrentTool()
  }, [])

  const selectionSnappingLines = useSnappingLines()

  return (
    <ShapeTool
      onComplete={onComplete}
      onCancel={onCancel}
      config={DRAW_LINE_ON_TERRAIN}
      onPreviewChange={onPreview}
      additionalSnappingLines={selectionSnappingLines}
    />
  )
}
