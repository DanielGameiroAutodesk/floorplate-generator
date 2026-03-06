import { Analytics } from "src/core/analytics"
import type { EventName } from "@spacemakerai/webapp-analytics"
import { FeatureCategory } from "@spacemakerai/webapp-analytics"

export type TransportationType = "road" | "rails"

export function dispatchTransportationEvent(
  transportationType: TransportationType,
  eventName: EventName,
  analyticsProperties?: Record<string, any>,
) {
  Analytics.track(
    eventName,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: transportationType,
      object_type: "element",
    },
    { category: transportationType, shape_type: "line", ...analyticsProperties },
  )
}
