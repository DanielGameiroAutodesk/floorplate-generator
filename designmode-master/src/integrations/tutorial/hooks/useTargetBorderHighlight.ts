import { useEffect } from "react"

const HIGHLIGHT_OVERLAY_ID = "tutorial-border-highlight-overlay"

/**
 * Custom hook to add a blue border highlight to a target element.
 * Creates an absolutely positioned overlay div that follows the target element,
 * which works even with web components and Shadow DOM.
 *
 * @param targetElement - The element to add the border highlight to
 * @param enabled - Whether the border highlight should be active
 */
export function useTargetBorderHighlight(targetElement: Element | null, enabled: boolean) {
  useEffect(() => {
    if (!targetElement || !enabled) {
      return
    }

    // Create an overlay div that will show the highlight border
    const overlay = document.createElement("div")
    overlay.id = HIGHLIGHT_OVERLAY_ID
    overlay.style.position = "fixed"
    overlay.style.pointerEvents = "none"
    overlay.style.zIndex = "10000"
    overlay.style.boxShadow = "0 0 0 5px #0696d7"
    overlay.style.borderRadius = "0"
    overlay.style.transition = "all 0.1s ease-out"

    // Function to update overlay position and size
    const updateOverlayPosition = () => {
      const rect = targetElement.getBoundingClientRect()
      overlay.style.top = `${rect.top}px`
      overlay.style.left = `${rect.left}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
    }

    // Initial position
    updateOverlayPosition()

    // Add to document
    document.body.appendChild(overlay)

    // Update position on scroll, resize, or any layout changes
    const handleUpdate = () => updateOverlayPosition()
    window.addEventListener("scroll", handleUpdate, true)
    window.addEventListener("resize", handleUpdate)

    // Use ResizeObserver to track target element size changes
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleUpdate)
      resizeObserver.observe(targetElement)
    }

    // Also update on animation frames for smooth tracking
    let rafId: number
    const updateLoop = () => {
      updateOverlayPosition()
      rafId = requestAnimationFrame(updateLoop)
    }
    rafId = requestAnimationFrame(updateLoop)

    // Cleanup: remove overlay and listeners
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      overlay.remove()
    }
  }, [targetElement, enabled])
}
