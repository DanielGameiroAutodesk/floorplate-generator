import { selectedSectionBoxSignal } from "./state"
import { EventName, type EventProperties, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { Analytics } from "src/core/analytics"

const eventProperties = {
  feature_category: FeatureCategory.DesignTool,
  feature: "Section Box",
} satisfies EventProperties

export const trackOpenSectionBox = () => {
  Analytics.track(EventName.Open, eventProperties)
}

export const trackCloseSectionBox = () => {
  Analytics.track(EventName.Close, eventProperties)
}

/**
 * Track the selection of a section box
 *
 * Call before the selection of a section box because it test if the section box is already selected
 */
export const trackSelectSectionBox = () => {
  if (selectedSectionBoxSignal.peek()) {
    Analytics.track(EventName.Select, eventProperties)
  } else {
    Analytics.track(EventName.Open, eventProperties)
  }
}

export const trackAddSectionBox = () => {
  Analytics.track(EventName.Add, eventProperties)
}

export const trackDeleteSectionBox = () => {
  Analytics.track(EventName.Delete, eventProperties)
}

export const trackEditSectionBox = (action_type: string) => {
  Analytics.track(EventName.Edit, { ...eventProperties }, { action_type })
}
