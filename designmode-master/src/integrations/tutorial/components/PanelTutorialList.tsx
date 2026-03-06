import { useMemo } from "react"
import type { Tutorial } from "src/integrations/tutorial/model"
import styles from "./TutorialPanelContent.module.pcss"
import { useCompletedTutorials } from "src/integrations/tutorial/hooks/useCompletedTutorials"
import { useTranslator } from "src/i18n"
import { closeTutorialPanel } from "src/integrations/tutorial/closeTutorial"
import TutorialCard from "./TutorialCard"
import combineClasses from "src/lib/combineClasses"

interface PanelTutorialListProps {
  tutorials: Tutorial[]
  onStart: (tutorial: Tutorial) => void
}

export default function PanelTutorialList({ tutorials, onStart }: PanelTutorialListProps) {
  const { isCompleted, clearCompletion } = useCompletedTutorials()
  const t = useTranslator()

  const { completedTutorials, incompleteTutorials } = useMemo(() => {
    const completed = tutorials.filter((tutorial) => isCompleted(tutorial.id))
    const incomplete = tutorials.filter((tutorial) => !isCompleted(tutorial.id))
    return { completedTutorials: completed, incompleteTutorials: incomplete }
  }, [tutorials, isCompleted])

  const hasCompletedSomeTutorials = completedTutorials.length > 0
  const hasIncompleteTutorials = incompleteTutorials.length > 0

  return (
    <div className={styles.PanelContent}>
      <div className={styles.PanelHeader}>
        <button className={styles.CloseButton} onClick={closeTutorialPanel} aria-label="Close">
          <weave-close />
        </button>
      </div>
      <div className={styles.PanelTitleContainer}>
        <h2 className={styles.PanelTitle}>{t(($) => $.tutorialWidget.allTutorialsTitle)}</h2>
        <p className={styles.PanelDescription}>{t(($) => $.tutorialWidget.allTutorialsDescription)}</p>
      </div>

      {/* Show "Up next" header only when there are both completed and incomplete tutorials */}
      {hasCompletedSomeTutorials && hasIncompleteTutorials && (
        <h3 className={styles.SectionHeader}>{t(($) => $.tutorialWidget.upNextTitle)}</h3>
      )}

      <ul className={styles.TutorialList}>
        {incompleteTutorials.map((tutorial) => (
          <TutorialCard key={tutorial.id} tutorial={tutorial} isCompleted={false} onStart={onStart} />
        ))}
      </ul>

      {/* Show completed section with header once user completes their first tutorial */}
      {hasCompletedSomeTutorials && (
        <>
          <h3 className={combineClasses([styles.SectionHeader], { [styles.CompletedSectionHeader]: true })}>
            {t(($) => $.tutorialWidget.completedTitle)}
          </h3>
          <ul className={styles.TutorialList}>
            {completedTutorials.map((tutorial) => (
              <TutorialCard key={tutorial.id} tutorial={tutorial} isCompleted={true} onStart={onStart} />
            ))}
          </ul>
        </>
      )}

      {/* Dev helper to reset completions */}
      {!import.meta.env.PROD && (
        <div className={styles.DevResetContainer}>
          <weave-button
            variant="flat"
            density="high"
            onClick={() => completedTutorials.forEach((tutorial) => clearCompletion(tutorial.id))}
          >
            🔄 Reset Completions (Dev)
          </weave-button>
        </div>
      )}
    </div>
  )
}
