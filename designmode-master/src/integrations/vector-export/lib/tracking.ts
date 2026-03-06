import { FeatureCategory, type EventProperties } from "@spacemakerai/webapp-analytics"

export const vectorExportEventProperties = {
  feature_category: FeatureCategory.DesignTool,
  feature: "Vector Export",
} satisfies EventProperties
