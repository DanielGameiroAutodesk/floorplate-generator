import { useMemo } from "react"
import styles from "./TutorialOverlay.module.pcss"
import { builtInTutorials } from "src/integrations/tutorial/builtInTutorials"
import PanelTutorialList from "./PanelTutorialList"
import PanelActiveTutorial from "./PanelActiveTutorial"
import type { useTutorialController } from "src/integrations/tutorial/hooks/useTutorialController"

interface TutorialPanelContentProps {
  controller: ReturnType<typeof useTutorialController>
  handleTutorialExit: () => void
}

export default function TutorialPanelContent({ controller, handleTutorialExit }: TutorialPanelContentProps) {
  const tutorials = useMemo(() => builtInTutorials, [])

  return (
    <div className={styles.TutorialContainer}>
      {controller.activeTutorial ? (
        <PanelActiveTutorial
          tutorial={controller.activeTutorial}
          currentStepIndex={controller.currentStepIndex}
          onExit={handleTutorialExit}
        />
      ) : (
        <PanelTutorialList tutorials={tutorials} onStart={controller.start} />
      )}
    </div>
  )
}
