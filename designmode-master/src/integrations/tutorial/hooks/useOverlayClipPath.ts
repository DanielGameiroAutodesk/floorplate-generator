import { useCallback, useEffect } from "react"
import type { RefObject } from "react"

/**
 * Creates a clip-path polygon that excludes the target element area,
 * creating a "spotlight" effect that highlights the target.
 * Excludes margins and padding from the highlighted area to focus only on the content area.
 */
function createClipPath(targetElement: Element): string {
  const rect = targetElement.getBoundingClientRect()
  const styles = window.getComputedStyle(targetElement)

  // Get margin values (can be negative, auto, or positive)
  const marginTop = parseFloat(styles.marginTop) || 0
  const marginRight = parseFloat(styles.marginRight) || 0
  const marginBottom = parseFloat(styles.marginBottom) || 0
  const marginLeft = parseFloat(styles.marginLeft) || 0

  // Get padding values
  const paddingTop = parseFloat(styles.paddingTop) || 0
  const paddingRight = parseFloat(styles.paddingRight) || 0
  const paddingBottom = parseFloat(styles.paddingBottom) || 0
  const paddingLeft = parseFloat(styles.paddingLeft) || 0

  // Additional spacing to add around the content area
  const additionalSpacing = 5

  // Adjust rect to exclude margins and padding, then add additional spacing
  const top = rect.top + marginTop + paddingTop - additionalSpacing
  const left = rect.left + marginLeft + paddingLeft - additionalSpacing
  const right = rect.right - marginRight - paddingRight + additionalSpacing
  const bottom = rect.bottom - marginBottom - paddingBottom + additionalSpacing

  return `polygon(0% 0%, 0% 100%, ${left}px 100%, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px 100%, 100% 100%, 100% 0%)`
}

/**
 * Custom hook to manage the tutorial overlay clip-path cutout.
 * Creates a clip-path that excludes the target element from the overlay,
 * creating a "spotlight" effect that highlights the target.
 *
 * @param overlayRef - React ref to the overlay element
 * @param targetElement - The element to create a cutout for in the overlay
 */
export function useOverlayClipPath(overlayRef: RefObject<HTMLDivElement>, targetElement: Element | null) {
  // Consolidated function to update the clip-path
  const updateClipPath = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    if (targetElement) {
      overlay.style.clipPath = createClipPath(targetElement)
    } else {
      // No target, show full overlay
      overlay.style.clipPath = "none"
    }
  }, [overlayRef, targetElement])

  // Initial clip-path setup and cleanup
  useEffect(() => {
    updateClipPath()

    // Capture current overlay ref for cleanup
    const currentOverlay = overlayRef.current

    // Cleanup when component unmounts or target changes
    return () => {
      if (currentOverlay) {
        currentOverlay.style.clipPath = "none"
      }
    }
  }, [updateClipPath, overlayRef])

  // Update clip-path on window resize and scroll to handle target movement
  useEffect(() => {
    if (!targetElement) return

    window.addEventListener("resize", updateClipPath)
    window.addEventListener("scroll", updateClipPath, true)

    return () => {
      window.removeEventListener("resize", updateClipPath)
      window.removeEventListener("scroll", updateClipPath, true)
    }
  }, [updateClipPath, targetElement])
}
