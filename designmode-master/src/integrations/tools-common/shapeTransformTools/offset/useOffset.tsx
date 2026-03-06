import { isDefined } from "src/lib/array"
import { selectionSetSignal } from "src/core/selection/selectionState"
import OffsetPolygon from "./OffsetFunction"
import type { TransformPolygonFunction } from "src/integrations/tools-common/shapeTransformTools/polygonTransformFunctions"
import kinks from "@turf/kinks"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useCallback } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"

export const useOffset = (radius: number) => {
  const snapshot = elementState.currentSnapshot.value
  const pathList = Array.from(selectionSetSignal.value)
  return useCallback<TransformPolygonFunction>(() => {
    let isValid = true

    const bufferedFeatures = pathList
      .map((path) => {
        const geojson = snapshot.getNode(path)?.elementContainer.representations.footprint
        if (!geojson || !(geojson.geometry.type === "Polygon")) return undefined

        const offset = OffsetPolygon(geojson.geometry.coordinates[0], radius)
        if (!offset.length) return undefined

        const bufferedGeojson: BasicFeature = {
          ...geojson,
          geometry: {
            ...geojson.geometry,
            coordinates: [offset],
          },
        }

        isValid = isValid && kinks(bufferedGeojson).features.length === 0

        return { basicAction: BasicElementAPI.updateFeature(path, bufferedGeojson), feature: bufferedGeojson, path }
      })
      .filter(isDefined)

    return {
      features: bufferedFeatures.map((bf) => bf.feature),
      actions: BasicElementAPI.basicActionsToCoreActions(bufferedFeatures.map((bf) => bf.basicAction)),
      isValid,
    }
  }, [pathList, radius, snapshot])
}
