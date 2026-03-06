import type { ReactNode } from "react"
import styles from "./Coachmark.module.pcss"
import { useTranslator } from "src/i18n"

interface CoachmarkContentProps {
  header: string
  coachmarkHeader?: string
  text: ReactNode
  image?: ReactNode
  currentStep?: number
  totalSteps?: number
  hideNextButton?: boolean
  onNext: () => void
  onClose: () => void
}

/**
 * Renders the coachmark UI (header, body, footer with buttons).
 * Pure presentational component.
 */
export default function CoachmarkContent({
  header,
  coachmarkHeader,
  text,
  image,
  currentStep,
  totalSteps,
  hideNextButton,
  onNext,
  onClose,
}: CoachmarkContentProps) {
  const t = useTranslator()

  return (
    <div className={styles.TutorialStep}>
      <div className={styles.Header}>
        {coachmarkHeader ? coachmarkHeader : header}
        <weave-icon-button onClick={onClose}>
          <weave-close slot="icon" />
        </weave-icon-button>
      </div>

      {image && <div className={styles.Image}>{image}</div>}

      <div className={styles.BodyCoachmark}>{text}</div>

      <div className={styles.Footer}>
        {currentStep && totalSteps && (
          <div className={styles.FooterText}>
            {t(($) => $.tutorialWidget.stepProgress, { current: currentStep - 1, total: totalSteps })}
          </div>
        )}
        {!hideNextButton && (
          <weave-button density="high" variant="solid" onClick={onNext}>
            {currentStep && totalSteps && currentStep - 1 === totalSteps
              ? t(($) => $.tutorialWidget.doneButton)
              : t(($) => $.tutorialWidget.nextButton)}
          </weave-button>
        )}
      </div>
    </div>
  )
}
