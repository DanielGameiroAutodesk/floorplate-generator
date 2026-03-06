import { Analytics } from "src/core/analytics"
import type { EventName } from "@spacemakerai/webapp-analytics"
import { FeatureCategory } from "@spacemakerai/webapp-analytics"

export type LimitElementType = "site_limit" | "zone" | "constraint"

export function dispatchLimitEvent(
  elementType: LimitElementType,
  eventName: EventName,
  analyticsProperties?: Record<string, any>,
) {
  Analytics.track(
    eventName,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: elementType,
      object_type: "element",
    },
    {
      category: elementType,
      shape_type: elementType === "constraint" ? "volume25d" : "surface",
      ...analyticsProperties,
    },
  )
}
