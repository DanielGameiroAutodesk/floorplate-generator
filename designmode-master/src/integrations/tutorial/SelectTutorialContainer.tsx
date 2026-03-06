import SlideInPanel, { TutorialPanelButton } from "./components/SlideInPanel"
import TutorialStepOverlay from "./components/TutorialStepOverlay"
import TutorialPanelContent from "./components/TutorialPanelContent"
import { useTutorialController } from "./hooks/useTutorialController"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"
import { builtInTutorials } from "./builtInTutorials"
import { isTutorialCompleted } from "./hooks/useCompletedTutorials"
import { useMemo } from "react"

const SelectTutorialContainer = () => {
  const isEnabled = useFeatureFlag(URLFlag.SelectTutorials)
  const controller = useTutorialController(null)

  // Check if there are more incomplete tutorials (excluding current one)
  // Use isTutorialCompleted which reads from localStorage directly
  const hasMoreTutorials = useMemo(() => {
    if (!controller.activeTutorial) return false

    // Count incomplete tutorials excluding the current one
    const incompleteTutorials = builtInTutorials.filter(
      (tutorial) => tutorial.id !== controller.activeTutorial?.id && !isTutorialCompleted(tutorial.id),
    )

    return incompleteTutorials.length > 0
  }, [controller.activeTutorial])

  if (!isEnabled) {
    return null
  }

  return (
    <>
      <SlideInPanel>
        <TutorialPanelContent controller={controller} handleTutorialExit={() => controller.reset()} />
      </SlideInPanel>
      <TutorialPanelButton />
      <TutorialStepOverlay
        activeTutorial={controller.activeTutorial}
        currentStep={controller.currentStep ?? null}
        currentStepIndex={controller.currentStepIndex}
        onNext={controller.next}
        onClose={() => controller.reset()}
        hasMoreTutorials={hasMoreTutorials}
      />
    </>
  )
}

export default SelectTutorialContainer
