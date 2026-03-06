// Shared constants for automated onboarding tracking
const TRACKING_FEATURE = "automated-onboarding"

export const EXPERIMENT_ID = "automated-onboarding-experiment"

export const IntroModalTracking = {
  eventProperties: {
    feature: TRACKING_FEATURE,
    sub_feature: "intro-modal",
  },
  Action: {
    CLOSE_BUTTON_CLICKED: "close-button-clicked",
    CONTINUE_BUTTON_CLICKED: "continue-button-clicked",
    SECTION_TOGGLED: "section-toggled",
  },
}

export const FinalModalTracking = {
  eventProperties: {
    feature: TRACKING_FEATURE,
    sub_feature: "final-modal",
  },
  Action: {
    CLOSE_BUTTON_CLICKED: "close-button-clicked",
    GOT_IT_BUTTON_CLICKED: "got-it-button-clicked",
    SHOW_ME_MORE_CLICKED: "show-me-more-clicked",
  },
}
