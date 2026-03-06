import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { getTargetElementDeep, waitForTargetElement } from "src/integrations/tutorial/utils/getTargetElementDeep"
import type { CoachmarkPlacement } from "src/integrations/tutorial/model"

interface Position {
  top: number
  left: number
  placement: CoachmarkPlacement
  arrowOffset?: {
    x?: number // Horizontal offset for top/bottom arrows (in pixels from left edge)
    y?: number // Vertical offset for left/right arrows (in pixels from top edge)
  }
}

interface ElementTargetAndPosition {
  target: Element | null
  position: Position | null
  coachmarkRef: RefObject<HTMLDivElement>
  contentRef: RefObject<HTMLDivElement>
}

/**
 * Custom hook that combines target element resolution and position calculation.
 *
 * @param targetId - The ID of the target element to find
 * @param placement - Optional preferred placement for the coachmark
 * @param onTargetClick - Optional callback when target element is clicked
 * @param advanceOnClick - Whether clicking the target should trigger onTargetClick (defaults to true)
 * @returns Object containing the target element, calculated position, and coachmark ref
 */
export function useElementTargetAndPosition(
  targetId?: string,
  placement?: CoachmarkPlacement,
  onTargetClick?: () => void,
  advanceOnClick?: boolean,
): ElementTargetAndPosition {
  const [targetElement, setTargetElement] = useState<Element | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const coachmarkRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  // Target element resolution
  useEffect(() => {
    if (!targetId) {
      setTargetElement(null)
      return
    }

    // Try immediate lookup first
    const immediateResult = getTargetElementDeep(targetId)
    if (immediateResult) {
      setTargetElement(immediateResult)
      return
    }

    // If not found immediately, wait for it to appear
    setTargetElement(null) // Clear previous target while waiting

    let isCancelled = false
    void waitForTargetElement(targetId).then((element) => {
      if (!isCancelled) {
        setTargetElement(element)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [targetId])

  // Add click listener to target element
  useEffect(() => {
    // Only add click listener if advanceOnClick is not explicitly false (defaults to true)
    const shouldAdvanceOnClick = advanceOnClick ?? true
    if (!targetElement || !targetId || !onTargetClick || !shouldAdvanceOnClick) return

    const handleClick = () => {
      // Don't prevent default or stop propagation - let the button work normally
      // Just advance the tutorial step
      onTargetClick()
    }

    // Use regular event listener (not capture) so button functionality works first
    targetElement.addEventListener("click", handleClick, false)

    return () => {
      targetElement.removeEventListener("click", handleClick, false)
    }
  }, [targetElement, targetId, onTargetClick, advanceOnClick])

  // Position calculation logic - completely rewritten with dynamic arrow positioning
  const calculatePosition = useCallback(
    (coachmarkDimensions: { width: number; height: number } | null) => {
      if (!targetElement) {
        setPosition(null)
        return
      }

      const targetRect = targetElement.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Use actual dimensions if available, fallback to CSS-defined dimensions
      // Width: 314px from TutorialStep.module.pcss
      // Height: Conservative estimate, will be corrected by ResizeObserver
      const coachmarkWidth = coachmarkDimensions?.width ?? 314
      const coachmarkHeight = coachmarkDimensions?.height ?? 200

      // Gap between coachmark and target (matches arrow base offset in CSS)
      const gap = 16

      // Viewport margin - minimum distance from viewport edges
      const viewportMargin = 8

      // Calculate target center
      const targetCenterX = targetRect.left + targetRect.width / 2
      const targetCenterY = targetRect.top + targetRect.height / 2

      // Calculate available space in each direction
      const spaceTop = targetRect.top
      const spaceBottom = viewportHeight - targetRect.bottom
      const spaceLeft = targetRect.left
      const spaceRight = viewportWidth - targetRect.right

      // Determine best placement
      let calculatedPlacement: CoachmarkPlacement = placement || "bottom"

      if (!placement) {
        // Auto-determine best placement based on available space
        // Priority: bottom > top > right > left (most common reading patterns)
        if (spaceBottom >= coachmarkHeight + gap) {
          calculatedPlacement = "bottom"
        } else if (spaceTop >= coachmarkHeight + gap) {
          calculatedPlacement = "top"
        } else if (spaceRight >= coachmarkWidth + gap) {
          calculatedPlacement = "right"
        } else if (spaceLeft >= coachmarkWidth + gap) {
          calculatedPlacement = "left"
        } else {
          // Fallback: choose placement with most space
          const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight)
          if (maxSpace === spaceBottom) calculatedPlacement = "bottom"
          else if (maxSpace === spaceTop) calculatedPlacement = "top"
          else if (maxSpace === spaceRight) calculatedPlacement = "right"
          else calculatedPlacement = "left"
        }
      }

      // Calculate ideal position based on placement (before viewport clamping)
      let top: number
      let left: number

      switch (calculatedPlacement) {
        case "top":
          // Position above target
          top = targetRect.top - coachmarkHeight - gap
          // Center horizontally on target
          left = targetCenterX - coachmarkWidth / 2
          break
        case "bottom":
          // Position below target
          top = targetRect.bottom + gap
          // Center horizontally on target
          left = targetCenterX - coachmarkWidth / 2
          break
        case "left":
          // Position to left of target
          left = targetRect.left - coachmarkWidth - gap
          // Center vertically on target
          top = targetCenterY - coachmarkHeight / 2
          break
        case "right":
          // Position to right of target
          left = targetRect.right + gap
          // Center vertically on target
          top = targetCenterY - coachmarkHeight / 2
          break
      }

      // Clamp to viewport bounds
      const clampedLeft = Math.max(viewportMargin, Math.min(left, viewportWidth - coachmarkWidth - viewportMargin))
      const clampedTop = Math.max(viewportMargin, Math.min(top, viewportHeight - coachmarkHeight - viewportMargin))

      // Calculate arrow offset to point to target center
      // Arrow is positioned relative to coachmark container
      const arrowOffset: { x?: number; y?: number } = {}

      if (calculatedPlacement === "top" || calculatedPlacement === "bottom") {
        // For top/bottom placements, arrow needs horizontal offset
        // Arrow should be positioned at targetCenterX relative to coachmark's left edge
        const rawArrowX = targetCenterX - clampedLeft

        // Clamp arrow position to stay within coachmark bounds (with some padding)
        const minArrowX = 32 // Minimum distance from left edge
        const maxArrowX = coachmarkWidth - 32 // Maximum distance from left edge
        arrowOffset.x = Math.max(minArrowX, Math.min(rawArrowX, maxArrowX))
      } else {
        // For left/right placements, arrow needs vertical offset
        // Arrow should be positioned at targetCenterY relative to coachmark's top edge
        const rawArrowY = targetCenterY - clampedTop

        // Clamp arrow position to stay within coachmark bounds (with some padding)
        const minArrowY = 32 // Minimum distance from top edge
        const maxArrowY = coachmarkHeight - 32 // Maximum distance from top edge
        arrowOffset.y = Math.max(minArrowY, Math.min(rawArrowY, maxArrowY))
      }

      setPosition({
        top: clampedTop,
        left: clampedLeft,
        placement: calculatedPlacement,
        arrowOffset,
      })
    },
    [targetElement, placement],
  )

  // Initial calculation without actual dimensions
  useEffect(() => {
    calculatePosition(dimensions)
  }, [calculatePosition, dimensions])

  // Set up ResizeObserver to measure actual coachmark dimensions
  // Observe the content div (TutorialStep) instead of the container (PositionedContainer)
  useEffect(() => {
    const contentElement = contentRef.current
    if (!contentElement) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const newDimensions = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        }

        // CRITICAL: Ignore 0x0 measurements - they're from before CSS/content loads
        // Only update dimensions if we have actual measurements
        if (newDimensions.width > 0 && newDimensions.height > 0) {
          setDimensions(newDimensions)
          // Immediately recalculate position with new dimensions
          calculatePosition(newDimensions)
        }
      }
    })

    resizeObserver.observe(contentElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [calculatePosition])

  // Recalculate on resize or scroll
  useEffect(() => {
    const handleUpdate = () => calculatePosition(dimensions)
    window.addEventListener("resize", handleUpdate)
    window.addEventListener("scroll", handleUpdate, true)

    return () => {
      window.removeEventListener("resize", handleUpdate)
      window.removeEventListener("scroll", handleUpdate, true)
    }
  }, [calculatePosition, dimensions])

  return {
    target: targetElement,
    position,
    coachmarkRef,
    contentRef,
  }
}
