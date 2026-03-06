import { Analytics } from "src/core/analytics"
import type { EventName } from "@spacemakerai/webapp-analytics"
import { FeatureCategory } from "@spacemakerai/webapp-analytics"

export type VegetationType = "tree_line" | "tree_area"

export function dispatchVegetationEvent(
  vegetationType: VegetationType,
  eventName: EventName,
  analyticsProperties?: Record<string, any>,
) {
  Analytics.track(
    eventName,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: vegetationType,
      object_type: "element",
    },
    {
      category: "vegetation",
      shape_type: vegetationType === "tree_line" ? "line" : "surface",
      ...analyticsProperties,
    },
  )
}
