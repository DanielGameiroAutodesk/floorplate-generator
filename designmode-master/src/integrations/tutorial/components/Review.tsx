import styles from "./Coachmark.module.pcss"
import { useTranslator } from "src/i18n"
import type { ReactNode } from "react"

interface ReviewProps {
  header: string
  text?: ReactNode
  onClose: () => void
  onNext?: () => void
  hasMoreTutorials: boolean
}

export default function Review({ header, text, onClose, onNext, hasMoreTutorials }: ReviewProps) {
  const t = useTranslator()

  const handleButtonClick = () => {
    // Mark tutorial as complete
    if (onNext) {
      onNext()
    }
    // Close overlay
    onClose()
  }

  const bodyContent = text || t(($) => $.tutorialWidget.completionMessage, { header })
  const buttonText = hasMoreTutorials ? "Next guide" : "Done"

  return (
    <div className={styles.CenteredContainer}>
      <div className={styles.TutorialStep}>
        <div className={styles.Header}>{header}</div>

        <div className={styles.Body}>{bodyContent}</div>

        <div className={styles.Footer}>
          <div></div>
          <weave-button density="high" variant="solid" onClick={handleButtonClick}>
            {buttonText}
          </weave-button>
        </div>
      </div>
    </div>
  )
}
