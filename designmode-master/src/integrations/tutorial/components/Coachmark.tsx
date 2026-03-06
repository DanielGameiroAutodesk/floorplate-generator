import type { ReactNode, RefObject } from "react"
import type { CoachmarkPlacement } from "src/integrations/tutorial/model"
import styles from "./Coachmark.module.pcss"
import { useElementTargetAndPosition } from "src/integrations/tutorial/hooks/useElementTargetAndPosition"
import { useOverlayClipPath } from "src/integrations/tutorial/hooks/useOverlayClipPath"
import { useTargetBorderHighlight } from "src/integrations/tutorial/hooks/useTargetBorderHighlight"
import { useCoachmarkVisibility } from "src/integrations/tutorial/hooks/useCoachmarkVisibility"
import { useAutoAdvance } from "src/integrations/tutorial/hooks/useAutoAdvance"
import { useClickOnNext } from "src/integrations/tutorial/hooks/useClickOnNext"
import CoachmarkContent from "./CoachmarkContent"
import CoachmarkArrow from "./CoachmarkArrow"

interface CoachmarkProps {
  header: string
  coachmarkHeader?: string
  text: ReactNode
  image?: ReactNode
  targetId?: string
  placement?: CoachmarkPlacement
  advanceOnClick?: boolean
  onNext: () => void
  currentStep?: number
  totalSteps?: number
  hideNextButton?: boolean
  onClose: () => void
  overlayRef: RefObject<HTMLDivElement>
  highlightBorder?: boolean
  clickOnNext?: boolean
  advanceWhen?: () => boolean
  hideCoachmarkWhileToolActive?: string
  hideWhileElementExists?: string
}

/**
 * Coachmark component - orchestrates tutorial step positioning and behavior.
 * Handles target element positioning, visibility conditions, and user interactions.
 */
export default function Coachmark({
  header,
  coachmarkHeader,
  text,
  image,
  targetId,
  placement,
  advanceOnClick,
  onNext,
  currentStep,
  totalSteps,
  hideNextButton,
  onClose,
  overlayRef,
  highlightBorder,
  clickOnNext,
  advanceWhen,
  hideCoachmarkWhileToolActive,
  hideWhileElementExists,
}: CoachmarkProps) {
  // Get target element and calculate position
  const {
    target: targetElement,
    position,
    coachmarkRef,
    contentRef,
  } = useElementTargetAndPosition(targetId, placement, onNext, advanceOnClick)

  // Manage overlay clip-path
  useOverlayClipPath(overlayRef, targetElement)

  // Check visibility conditions (tool active, element exists)
  const shouldHideCoachmark = useCoachmarkVisibility(hideCoachmarkWhileToolActive, hideWhileElementExists)

  // Add border highlight when visible
  useTargetBorderHighlight(targetElement, (highlightBorder ?? false) && !shouldHideCoachmark)

  // Auto-advance when condition is met
  useAutoAdvance(advanceWhen, onNext)

  // Handle click-on-next behavior
  const handleNext = useClickOnNext(clickOnNext, targetElement, onNext)

  // Calculate fallback position if no target element
  const fallbackPosition = !targetElement
    ? {
        top: 175,
        left: window.innerWidth / 2 - 150,
        placement: "bottom" as CoachmarkPlacement,
        arrowOffset: undefined,
      }
    : null

  const finalPosition = position || fallbackPosition
  if (!finalPosition) return null

  // Hide coachmark based on conditions
  if (shouldHideCoachmark) {
    return null
  }

  return (
    <div
      className={styles.PositionedContainer}
      ref={coachmarkRef}
      style={{
        top: finalPosition.top,
        left: finalPosition.left,
        pointerEvents: "auto",
      }}
    >
      <div ref={contentRef}>
        <CoachmarkContent
          header={header}
          coachmarkHeader={coachmarkHeader}
          text={text}
          image={image}
          currentStep={currentStep}
          totalSteps={totalSteps}
          hideNextButton={hideNextButton}
          onNext={handleNext}
          onClose={onClose}
        />
      </div>

      <CoachmarkArrow
        targetElement={targetElement}
        placement={finalPosition.placement}
        arrowOffset={finalPosition.arrowOffset}
      />
    </div>
  )
}
