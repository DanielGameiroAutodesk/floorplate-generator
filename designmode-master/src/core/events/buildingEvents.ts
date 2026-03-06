import { Analytics } from "src/core/analytics"
import type { EventName } from "@spacemakerai/webapp-analytics"
import { FeatureCategory } from "@spacemakerai/webapp-analytics"

export type BuildingType = "basic_building" | "line_building" | "row_house"

export type CreationMethod = "draw" | "copy" | "volume_conversion" | "building_conversion" | "contextual_data"

export function dispatchBuildingEvent(
  buildingType: BuildingType,
  eventName: EventName,
  creationMethod?: CreationMethod,
  analyticsProperties?: Record<string, any>,
) {
  Analytics.track(
    eventName,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: buildingType,
      object_type: "element",
    },
    {
      category: buildingType,
      ...(creationMethod && { creation_method: creationMethod }),
      shape_type: "volume25d",
      ...analyticsProperties,
    },
  )
}
