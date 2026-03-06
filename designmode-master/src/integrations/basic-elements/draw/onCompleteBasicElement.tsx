import { useCallback } from "react"

import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { InternalPath } from "src/lib/element/path"
import type { Shape } from "src/lib/three/Shape/types"
import { AnalyticsUtils } from "src/core/analytics"
import { categoryToDefaultLineWidth, shapeToBasicLine, shapeToPolygonFeature } from "src/lib/three/Shape/shapeUtils"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { isExtrudedPolygon } from "src/lib/geometry/geometryTypes"
import { Box2, Matrix4, Vector2 } from "three"
import { elementState } from "src/core/elements/ElementState"
import { contextRootSignal, scenarioModeSignal, setSelectionSignalValue } from "src/core/selection/selectionState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { batch } from "@preact/signals"
import { useIsImperial } from "src/lib/unitSettings"

const IDENTITY = new Matrix4().toArray()
// this will normalize the coordinates of the feature so that they are centered around the origin
// and return a transformation matrix that can be used to translate the element so that it will still show up in the right location
// this is done to prevent losing floating point precision because of large numbers if we use world coordinates
const normalizeExtrudedPolygonCoordinates = (feature: BasicFeature) => {
  if (isExtrudedPolygon(feature)) {
    const { coordinates } = feature.geometry
    const vec2 = new Vector2()
    const bbox = new Box2()
    const z = feature.properties.elevation + feature.properties.height / 2
    // use outer ring to determine bbox
    for (let point of coordinates[0]) {
      vec2.set(point[0], point[1])
      bbox.expandByPoint(vec2)
    }
    const center = bbox.getCenter(new Vector2())

    const newCoordinates = coordinates.map((points) => {
      return points.map((point) => {
        return [point[0] - center.x, point[1] - center.y]
      })
    })
    const newElevation = feature.properties.elevation - z

    const newFeature = {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: newCoordinates,
      },
      properties: {
        ...feature.properties,
        elevation: newElevation,
      },
    }

    return {
      feature: newFeature,
      transform: new Matrix4().makeTranslation(center.x, center.y, z).toArray(),
    }
  }
  return {
    feature,
    transform: IDENTITY,
  }
}

// Should not be exported, as this is specific to creating a single basic element and setting the selection based on that
const useCreateSingleBasicElement = () => {
  const ActionAPI = useActionAPI()

  return useCallback(
    (parentPath: InternalPath, feature: BasicFeature, properties: BasicElementProperties) => {
      const { feature: normalizedFeature, transform } = normalizeExtrudedPolygonCoordinates(feature)
      const actions = BasicElementAPI.basicActionsToCoreActions([
        BasicElementAPI.create(contextRootSignal.peek(), normalizedFeature, properties, transform),
      ])

      batch(() => {
        ActionAPI.apply(`Add ${properties.category}`, actions, {
          numElements: 1,
          eventType: "add",
          elementCategory: properties.category ?? "",
          inScenario: AnalyticsUtils.trackedInScenarioFlag([scenarioModeSignal.peek()]),
          tool: toolAPI.currentToolSignal.peek().id,
        })

        setSelectionSignalValue([ActionAPI.utils.getPathOfAction(actions.filter((a) => a.type === "create")[0])])
        exitCurrentTool()
      })
    },
    [ActionAPI],
  )
}

export const useOnCompleteLine = (properties: BasicElementProperties) => {
  const isImperial = useIsImperial()
  const createBasicElement = useCreateSingleBasicElement()

  return useCallback(
    (line?: { shape: Shape; close: boolean }, additionalProperties?: { [key: string]: any }) => {
      if (!line) {
        exitCurrentTool()
        return
      }
      const contextTransform = elementState.currentSnapshot.peek().getNodeOrThrow(contextRootSignal.peek()).globalMatrix
      const adjustToParent = contextTransform.clone().invert()
      const shape = { ...line.shape }
      shape.vertices = shape.vertices.map((v) => v.clone().applyMatrix4(adjustToParent))
      const lineWidth = categoryToDefaultLineWidth(isImperial, properties.category)
      const feature = shapeToBasicLine(shape, { lineWidth }, line.close)

      createBasicElement(contextRootSignal.peek(), feature, {
        ...properties,
        ...additionalProperties,
      })
    },

    [createBasicElement, isImperial, properties],
  )
}

export const useOnCompletePolygon = (properties: BasicElementProperties) => {
  const createBasicElement = useCreateSingleBasicElement()

  return useCallback(
    (shape?: Shape, additionalProperties?: { [key: string]: any }) => {
      if (!shape) {
        exitCurrentTool()
        return
      }
      const polygon: Shape = { ...shape }
      const contextTransform = elementState.currentSnapshot.peek().getNodeOrThrow(contextRootSignal.peek()).globalMatrix
      const adjustToParent = contextTransform.clone().invert()
      polygon.vertices = polygon.vertices.map((v) => v.clone().applyMatrix4(adjustToParent))
      const feature = shapeToPolygonFeature(polygon)

      createBasicElement(contextRootSignal.peek(), feature, {
        ...properties,
        ...additionalProperties,
      })
    },
    [createBasicElement, properties],
  )
}
export const useOnCompleteExtrudedPolygon = (properties: BasicElementProperties) => {
  const createBasicElement = useCreateSingleBasicElement()

  return useCallback(
    (volume?: { shape: Shape; height: number }, additionalProperties?: { [key: string]: any }) => {
      if (!volume) {
        exitCurrentTool()
        return
      }
      const { shape, height } = volume
      const polygon: Shape = { ...shape }
      const contextTransform = elementState.currentSnapshot.peek().getNodeOrThrow(contextRootSignal.peek()).globalMatrix
      const adjustToParent = contextTransform.clone().invert()
      polygon.vertices = polygon.vertices.map((v) => v.clone().applyMatrix4(adjustToParent))
      const feature = shapeToPolygonFeature(polygon, height)

      createBasicElement(contextRootSignal.peek(), feature, {
        ...properties,
        ...additionalProperties,
      })
    },

    [createBasicElement, properties],
  )
}
