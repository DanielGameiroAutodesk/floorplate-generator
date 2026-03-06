import { useCallback, useMemo } from "preact/compat"
import { Matrix4, Vector3 } from "three"
import type { BasicFeaturePathInfo } from "src/core/selection/selected-basic-features"
import type { BasicFeature, ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import type { TrackingData } from "src/core/analytics"
import { AnalyticsUtils } from "src/core/analytics"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { BasicAction } from "src/integrations/basic-elements/api/types"
import { ExtrusionPropertiesStats } from "src/lib/components/RightMenu/ExtrusionProperties/ExtrustionPropertiesStats"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"

const updateElevationForElement = (
  { geojson, worldMatrix }: BasicFeaturePathInfo,
  newElevation: number,
): BasicFeature => {
  const elevation = new Vector3(0, 0, newElevation).applyMatrix4((worldMatrix ?? new Matrix4()).clone().invert()).z
  return {
    ...(geojson as ExtrudedPolygonFeature),
    properties: {
      ...(geojson.properties as ExtrudedPolygonFeature["properties"]),
      elevation,
    },
  }
}

export const ExtrusionProperties = ({ selected }: { selected: BasicFeaturePathInfo[] }) => {
  const ActionsAPI = useActionAPI()

  const existingExtrusion: { height: undefined | number; elevation: undefined | number } = useMemo(() => {
    const elevations: Set<number> = new Set()
    const heights: Set<number> = new Set()
    selected.forEach((sel) => {
      const worldMatrix = sel.worldMatrix ?? new Matrix4()
      const props = sel.geojson.properties as { height: number; elevation?: number }
      const elevation = new Vector3(0, 0, props.elevation || 0).applyMatrix4(worldMatrix).z
      elevations.add(elevation)
      heights.add(props.height)
    })

    const elevation = elevations.size === 1 ? Array.from(elevations)[0] : undefined
    const height = heights.size === 1 ? Array.from(heights)[0] : undefined

    return {
      height,
      elevation,
    }
  }, [selected])

  const onHeightSubmit = useCallback(
    (newHeight: number) => {
      if (isNaN(newHeight)) return

      const basicActions = selected.map(({ path, geojson }): BasicAction => {
        const newFeature: BasicFeature = {
          ...(geojson as ExtrudedPolygonFeature),
          properties: {
            ...(geojson.properties as ExtrudedPolygonFeature["properties"]),
            height: newHeight,
          },
        }
        return BasicElementAPI.updateFeature(path, newFeature)
      })

      const categories = selected.map((s) => s.element.properties?.category)
      const trackingData: TrackingData = {
        elementCategory: AnalyticsUtils.trackedElementCategory(categories),
        eventType: "update",
        numElements: selected.length,
        tool: "extrusionProperties",
      }

      const actions = BasicElementAPI.basicActionsToCoreActions(basicActions)

      ActionsAPI.apply("Element - Set height", actions, trackingData)
    },
    [selected, ActionsAPI],
  )

  const onElevationSubmit = useCallback(
    (newElevation: number) => {
      if (isNaN(newElevation)) return

      const basicActions = selected.map((s) =>
        BasicElementAPI.updateFeature(s.path, updateElevationForElement(s, newElevation)),
      )
      const actions = BasicElementAPI.basicActionsToCoreActions(basicActions)
      ActionsAPI.apply("Element - Set elevation", actions)
    },
    [ActionsAPI, selected],
  )

  return (
    <ExtrusionPropertiesStats
      elevation={existingExtrusion.elevation}
      height={existingExtrusion.height}
      onElevationSubmit={onElevationSubmit}
      onHeightSubmit={onHeightSubmit}
      canEditProposal={canEditProposalSignal.value}
    />
  )
}
