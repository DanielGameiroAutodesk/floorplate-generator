import { useTranslator } from "src/i18n"
import styles from "./PanelActiveTutorial.module.pcss"
import CheckIcon14 from "src/integrations/tutorial/icons/CheckIcon14"
import type { Tutorial } from "src/integrations/tutorial/model"
import { closeTutorialPanel } from "src/integrations/tutorial/closeTutorial"

interface PanelActiveTutorialProps {
  tutorial: Tutorial
  currentStepIndex: number
  onExit: () => void
}

export default function PanelActiveTutorial({ tutorial, currentStepIndex, onExit }: PanelActiveTutorialProps) {
  const t = useTranslator()

  // when tutorialStepIndex is 0, we want to show 0% progress
  const tutorialStepIndex = currentStepIndex - 1
  let progressPercent = 0
  if (tutorialStepIndex >= 0) {
    // Calculate progress based on displayed steps only, capped at 100%
    const calculatedPercentage = Math.round((tutorialStepIndex / tutorial.steps.length) * 100)
    progressPercent = Math.min(100, calculatedPercentage)
  }

  return (
    <div className={styles.PanelContent}>
      <div className={styles.ActivePanelHeader}>
        <button className={styles.BackButton} onClick={onExit} aria-label="Back to tutorials">
          <forma-icon-arrow-left />
        </button>
        <button className={styles.CloseButton} onClick={closeTutorialPanel} aria-label="Close">
          <weave-close />
        </button>
      </div>
      <div className={styles.ProgressSection}>
        <div className={styles.PanelTitleContainer}>
          <h2 className={styles.PanelTitle}>{t.getText(tutorial.title)}</h2>
          <span className={styles.ProgressPercent}>
            {t(($) => $.tutorialWidget.completionText, { percent: progressPercent })}
          </span>
        </div>
        <div className={styles.ProgressBar}>
          <div className={styles.ProgressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className={styles.Divider} />

      <div className={styles.StepsSection}>
        <ul className={styles.StepList}>
          {tutorial.steps.map((step, index) => {
            const isActive = index === tutorialStepIndex
            const isStepCompleted = index < tutorialStepIndex

            return (
              <li
                key={index}
                className={`${styles.StepItem} ${isActive ? styles.StepItemActive : ""} ${isStepCompleted ? styles.StepItemCompleted : ""}`}
              >
                <div className={styles.StepIndicator}>
                  {isStepCompleted ? (
                    <div className={styles.StepCheck}>
                      <CheckIcon14 />
                    </div>
                  ) : (
                    <div className={`${styles.StepNumber} ${isActive ? styles.StepNumberActive : ""}`}>{index + 1}</div>
                  )}
                </div>
                <span className={styles.StepText}>{t.getText(step.header)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
