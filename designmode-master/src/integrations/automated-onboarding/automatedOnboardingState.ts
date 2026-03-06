import { signal } from "@preact/signals"

export const AUTOMATED_ONBOARDING_PARAM = "automated-onboarding"

/**
 * Signal that tracks if the current user came via the automated onboarding experiment.
 * Set to true when URL has ?automated-onboarding parameter.
 */
export const runAutomatedOnboardingSignal = signal(
  new URLSearchParams(window.location.search).has(AUTOMATED_ONBOARDING_PARAM),
)

/**
 * Signal that tracks if the automated onboarding has successfully triggered the sun analysis.
 * Used by the coachmark to know when to appear.
 */
export const hasTriggeredSunAnalysisSignal = signal(false)
