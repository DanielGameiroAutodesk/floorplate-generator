import { useCallback, useEffect, useMemo, useState } from "react"
import { Analytics } from "src/core/analytics"
import { EventName } from "@spacemakerai/webapp-analytics"
import type { CurrentStep, Tutorial } from "src/integrations/tutorial/model"
import { markTutorialComplete } from "./useCompletedTutorials"
import { closeTutorial, closeTutorialPanel } from "src/integrations/tutorial/closeTutorial"
import { SITE_DESIGN_TUTORIALS_ANALYTICS } from "src/integrations/tutorial/analyticsConstant"
import { getTranslator } from "src/i18n"

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

/**
 * Custom hook for managing tutorial state and navigation
 */
export const useTutorialController = (initialTutorial: Tutorial | null = null) => {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const currentStep = useMemo<CurrentStep | undefined>(() => {
    if (!activeTutorial) {
      return undefined
    }
    if (currentStepIndex === 0) {
      return undefined
    }

    // Check if we're at the review step (after all tutorial steps)
    if (currentStepIndex === activeTutorial.steps.length + 1) {
      // If tutorial has review properties, create a review step
      if (activeTutorial.reviewHeader) {
        return {
          header: activeTutorial.reviewHeader,
          text: activeTutorial.reviewText,
          stepType: "review",
        }
      }
      // Otherwise, completed state - return undefined
      return undefined
    }

    // Regular tutorial step (adjust index since we removed cover step)
    const step = activeTutorial.steps[currentStepIndex - 1]
    return { ...step, stepType: "tutorial" }
  }, [activeTutorial, currentStepIndex])

  const isFirstStep = useMemo(
    () => (activeTutorial ? currentStepIndex === 0 : false),
    [activeTutorial, currentStepIndex],
  )

  const start = useCallback((tutorial: Tutorial) => {
    setActiveTutorial(tutorial)
    setCurrentStepIndex(1) // Start at first step (index 1)

    Analytics.track(
      EventName.Open,
      { ...SITE_DESIGN_TUTORIALS_ANALYTICS, sub_feature: "tutorial_start" },
      {
        tutorial_id: tutorial.id,
      },
    )
  }, [])

  // Set initial tutorial through start function to ensure analytics tracking
  useEffect(() => {
    if (initialTutorial) {
      start(initialTutorial)
    }
  }, [initialTutorial, start])

  const cancel = useCallback(() => {
    if (!activeTutorial) return

    const completedTutorialSteps = clampValue(currentStepIndex - 1, 0, activeTutorial.steps.length)
    const completionPercentage = Math.round((completedTutorialSteps / activeTutorial.steps.length) * 100)
    const currentStepType = currentStep?.stepType

    const t = getTranslator()
    const header = activeTutorial.steps[currentStepIndex - 1]?.header
    Analytics.track(EventName.Close, SITE_DESIGN_TUTORIALS_ANALYTICS, {
      tutorial_id: activeTutorial.id,
      step_type: currentStepType,
      current_step: currentStepIndex,
      current_step_title: header ? t.getText(header) : undefined,
      total_steps: activeTutorial.steps.length,
      completion_percentage: completionPercentage,
      completed_steps: `${completedTutorialSteps} of ${activeTutorial.steps.length}`,
    })

    closeTutorial(true)
    closeTutorialPanel()
  }, [activeTutorial, currentStep?.stepType, currentStepIndex])

  const reset = useCallback(() => {
    // Reset the controller to show the widget again
    setActiveTutorial(null)
    setCurrentStepIndex(0)
  }, [])

  const next = useCallback(() => {
    if (!activeTutorial) return

    const nextIndex = currentStepIndex + 1

    // Track analytics when advancing from current step (including from last step to completion)
    if (currentStepIndex >= 0 && currentStepIndex <= activeTutorial.steps.length) {
      const nextStepIndex = Math.min(nextIndex, activeTutorial.steps.length)
      const header = activeTutorial.steps[nextStepIndex - 1]?.header
      const t = getTranslator()
      Analytics.track(
        EventName.Select,
        { ...SITE_DESIGN_TUTORIALS_ANALYTICS, sub_feature: "tutorial_step_advance" },
        {
          tutorial_id: activeTutorial.id,
          current_step_title: header ? t.getText(header) : undefined,
          completed_steps: currentStepIndex,
          total_steps: activeTutorial.steps.length,
          completion_percentage: Math.round((currentStepIndex / activeTutorial.steps.length) * 100),
        },
      )
    }

    // Advance to next step or completion state
    if (nextIndex <= activeTutorial.steps.length) {
      // Moving to another tutorial step
      setCurrentStepIndex(nextIndex)
    } else {
      // Completed all steps - enter completion state (user can manually close)
      markTutorialComplete(activeTutorial.id)
      setCurrentStepIndex(activeTutorial.steps.length + 1)
      // Note: Don't dismiss here - let cancel() handle dismissal when user closes
    }
  }, [activeTutorial, currentStepIndex])

  // Determine if tutorial is in completed state
  const isCompleted = activeTutorial && currentStepIndex === activeTutorial.steps.length + 1

  return {
    activeTutorial,
    currentStepIndex,
    currentStep,
    isFirstStep,
    isCompleted,
    start,
    cancel,
    reset,
    next,
  }
}
