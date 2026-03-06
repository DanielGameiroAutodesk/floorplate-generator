import ClockIcon from "src/integrations/tutorial/icons/ClockIcon"
import type { Tutorial } from "src/integrations/tutorial/model"
import styles from "./TutorialPanelContent.module.pcss"
import { useTranslator } from "src/i18n"
import combineClasses from "src/lib/combineClasses"

interface TutorialCardProps {
  tutorial: Tutorial
  isCompleted: boolean
  onStart: (tutorial: Tutorial) => void
}

export default function TutorialCard({ tutorial, isCompleted, onStart }: TutorialCardProps) {
  const t = useTranslator()

  return (
    <li className={styles.TutorialItem}>
      <button
        className={combineClasses([styles.TutorialButton], { [styles.TutorialButtonCompleted]: isCompleted })}
        onClick={() => onStart(tutorial)}
      >
        <div className={styles.TutorialContent}>
          {tutorial.icon && (
            <div className={combineClasses([styles.TutorialIcon], { [styles.TutorialIconCompleted]: isCompleted })}>
              {tutorial.icon}
            </div>
          )}
          <div className={styles.TutorialInfo}>
            <h3 className={styles.TutorialTitle}>{t.getText(tutorial.title)}</h3>
            <p className={styles.TutorialDescription}>{tutorial.description(t)}</p>
            {!isCompleted && (
              <div className={styles.TutorialTime}>
                <ClockIcon />
                <span>{t(($) => $.tutorialWidget.timeLabel, { time: tutorial.time })}</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.TutorialItemRight}>
          <forma-icon-arrow-right />
        </div>
      </button>
    </li>
  )
}
