import { useEffect, useRef, useState } from "preact/hooks"
import { hasTriggeredSunAnalysisSignal } from "./automatedOnboardingState"
import { activeAnalysisSignal } from "src/integrations/analyses/analysis-state"
import styles from "src/integrations/tutorial/components/Coachmark.module.pcss"
import { getTargetElementDeep } from "src/integrations/tutorial/utils/getTargetElementDeep"
import { useTranslator } from "src/i18n"

const TARGET_ID = "sun-analysis-select"
const COACHMARK_WIDTH = 314
const GAP = 16
const ARROW_OFFSET = 24

/**
 * Coachmark for automated onboarding - shows after sun analysis is triggered.
 */
export default function SunAnalysisCoachmark() {
  const t = useTranslator()
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const hasBeenDismissedRef = useRef(false)

  const hasTriggered = hasTriggeredSunAnalysisSignal.value
  const currentAnalysis = activeAnalysisSignal.value

  // Listen for when user opens an analysis result and close the coachmark
  useEffect(() => {
    const handleAnalysisOpen = () => {
      hasBeenDismissedRef.current = true
      setIsVisible(false)
    }

    window.addEventListener("open-analysis", handleAnalysisOpen)
    return () => window.removeEventListener("open-analysis", handleAnalysisOpen)
  }, [])

  useEffect(() => {
    // Dismiss permanently when user clicks sun analysis
    if (currentAnalysis === "sun" && hasTriggered) {
      hasBeenDismissedRef.current = true
      setIsVisible(false)
      return
    }

    setIsVisible(hasTriggered && !hasBeenDismissedRef.current)
  }, [hasTriggered, currentAnalysis])

  // Position relative to target element
  useEffect(() => {
    if (!isVisible) return

    const updatePosition = () => {
      const target = getTargetElementDeep(TARGET_ID)
      if (!target) return

      const rect = target.getBoundingClientRect()
      // Position coachmark to the left of the target, with arrow pointing at target's vertical center
      setPosition({
        // Align arrow (at ARROW_OFFSET from top) with target center
        // And place to the left of target with gap
        top: rect.top + rect.height / 2 - ARROW_OFFSET,
        left: rect.left - COACHMARK_WIDTH - GAP,
      })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [isVisible])

  if (!isVisible || !position) return null

  return (
    <div
      className={styles.PositionedContainer}
      style={{ top: position.top, left: position.left, pointerEvents: "auto" }}
    >
      <div className={styles.TutorialStep}>
        <div className={styles.Header}>{t(($) => $.automatedOnboarding.sunAnalysisCoachmark.header)}</div>
        <div className={styles.BodyCoachmark}>
          {t.component(($) => $.automatedOnboarding.sunAnalysisCoachmark.body, { br: <br /> })}
        </div>
      </div>
      <div className={`${styles.Arrow} ${styles.ArrowLeft}`} style={{ top: "24px" }} />
    </div>
  )
}
