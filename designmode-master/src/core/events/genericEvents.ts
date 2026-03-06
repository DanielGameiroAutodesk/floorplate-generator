import { Analytics } from "src/core/analytics"
import type { EventName } from "@spacemakerai/webapp-analytics"
import { FeatureCategory } from "@spacemakerai/webapp-analytics"

export type GenericElementType = "volume" | "surface" | "line"

export function dispatchGenericElementEvent(
  elementType: GenericElementType,
  eventName: EventName,
  analyticsProperties?: Record<string, any>,
) {
  const getShapeType = (type: GenericElementType): string => {
    switch (type) {
      case "volume":
        return "volume25d"
      case "surface":
        return "surface"
      case "line":
        return "line"
    }
  }

  Analytics.track(
    eventName,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: elementType,
      object_type: "element",
    },
    {
      category: "generic",
      shape_type: getShapeType(elementType),
      ...analyticsProperties,
    },
  )
}
