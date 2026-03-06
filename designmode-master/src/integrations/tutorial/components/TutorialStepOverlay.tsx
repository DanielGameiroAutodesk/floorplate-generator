import { useRef } from "react"
import combineClasses from "src/lib/combineClasses"
import styles from "./TutorialOverlay.module.pcss"
import TutorialStep from "./TutorialStep"
import useCaptureClicks from "src/integrations/tutorial/hooks/useCaptureClicks"
import type { Tutorial } from "src/integrations/tutorial/model"
import type { CurrentStep } from "src/integrations/tutorial/model"

interface TutorialStepOverlayProps {
  activeTutorial: Tutorial | null
  currentStep: CurrentStep | null
  currentStepIndex: number
  onNext: () => void
  onClose: () => void
  hasMoreTutorials: boolean
}

export default function TutorialStepOverlay({
  activeTutorial,
  currentStep,
  currentStepIndex,
  onNext,
  onClose,
  hasMoreTutorials,
}: TutorialStepOverlayProps) {
  const showLightbox = Boolean(activeTutorial && currentStep?.stepType === "tutorial" && !currentStep?.hideLightbox)

  useCaptureClicks(activeTutorial !== null && showLightbox)

  const overlayRef = useRef<HTMLDivElement>(null)

  if (!currentStep || !activeTutorial) {
    return null
  }

  return (
    <div
      ref={overlayRef}
      id="tutorial-overlay-root"
      className={combineClasses([styles.OverlayRoot], { [styles.OverlayActive]: showLightbox })}
    >
      <TutorialStep
        activeTutorial={activeTutorial}
        step={currentStep}
        onNext={onNext}
        onClose={onClose}
        currentStep={currentStepIndex + 1}
        overlayRef={overlayRef}
        hasMoreTutorials={hasMoreTutorials}
      />
    </div>
  )
}
