import { FeatureCategory } from "@spacemakerai/webapp-analytics"

/**
 * Common analytics tracking constants for the board tutorials experiment.
 * This ensures consistency across all tracking calls and reduces typos.
 */
export const SITE_DESIGN_TUTORIALS_ANALYTICS = {
  feature_category: FeatureCategory.UserInterface,
  feature: "site-design-tutorials",
} as const
