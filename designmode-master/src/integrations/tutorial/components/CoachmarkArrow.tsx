import type { CoachmarkPlacement } from "src/integrations/tutorial/model"
import styles from "./Coachmark.module.pcss"

interface CoachmarkArrowProps {
  targetElement: Element | null
  placement: CoachmarkPlacement
  arrowOffset?: { x?: number; y?: number }
}

/**
 * Renders the arrow pointing from coachmark to target element.
 * Handles dynamic positioning based on placement and offset.
 */
export default function CoachmarkArrow({ targetElement, placement, arrowOffset }: CoachmarkArrowProps) {
  if (!targetElement) {
    return null
  }

  const getArrowStyle = () => {
    if (!arrowOffset) return {}

    const { x, y } = arrowOffset

    // For top/bottom placements, override left position
    if ((placement === "top" || placement === "bottom") && x !== undefined) {
      return {
        left: `${x}px`,
        transform: "translateX(-50%)", // Keep the transform to center the arrow on the point
      }
    }

    // For left/right placements, override top position
    if ((placement === "left" || placement === "right") && y !== undefined) {
      return {
        top: `${y}px`,
        transform: "translateY(-50%)", // Keep the transform to center the arrow on the point
      }
    }

    return {}
  }

  return (
    <div
      className={`${styles.Arrow} ${styles[`Arrow${placement.charAt(0).toUpperCase() + placement.slice(1)}`]}`}
      style={getArrowStyle()}
    />
  )
}
