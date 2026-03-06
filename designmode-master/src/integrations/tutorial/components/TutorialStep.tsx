import type { RefObject } from "react"
import Coachmark from "./Coachmark"
import type { CurrentStep, Tutorial } from "src/integrations/tutorial/model"
import Review from "./Review"
import { useTranslator } from "src/i18n"

interface TutorialStepProps {
  activeTutorial: Tutorial
  step: CurrentStep
  onNext: () => void
  onClose: () => void
  currentStep: number
  overlayRef: RefObject<HTMLDivElement>
  hasMoreTutorials: boolean
}

export default function TutorialStep({
  activeTutorial,
  step,
  onNext,
  onClose,
  currentStep,
  overlayRef,
  hasMoreTutorials,
}: TutorialStepProps) {
  const t = useTranslator()
  switch (step.stepType) {
    case "tutorial":
      return (
        <Coachmark
          header={t.getText(step.header)}
          coachmarkHeader={step.coachmarkHeader}
          text={step.text(t)}
          image={step.image?.(t)}
          targetId={step.targetId}
          placement={step.placement}
          advanceOnClick={step.advanceOnClick}
          hideNextButton={step.hideNextButton}
          highlightBorder={step.highlightBorder}
          clickOnNext={step.clickOnNext}
          advanceWhen={step.advanceWhen}
          hideCoachmarkWhileToolActive={step.hideCoachmarkWhileToolActive}
          hideWhileElementExists={step.hideWhileElementExists}
          onNext={onNext}
          onClose={onClose}
          currentStep={currentStep}
          totalSteps={activeTutorial.steps.length}
          overlayRef={overlayRef}
        />
      )

    case "review":
      return (
        <Review
          header={t.getText(step.header)}
          text={step.text ? step.text(t) : undefined}
          onClose={onClose}
          onNext={onNext}
          hasMoreTutorials={hasMoreTutorials}
        />
      )

    default:
      return null
  }
}
