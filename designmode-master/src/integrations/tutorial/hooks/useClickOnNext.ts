import { useCallback } from "react"
import { isClickableElement } from "src/integrations/tutorial/utils/domHelpers"

/**
 * Hook to create a next handler that optionally clicks the target element first.
 * Used when clickOnNext is true - clicks the target, waits briefly, then advances.
 */
export function useClickOnNext(clickOnNext: boolean | undefined, targetElement: Element | null, onNext: () => void) {
  return useCallback(() => {
    if (clickOnNext && targetElement) {
      // Check if element is a standard button type
      if (isClickableElement(targetElement)) {
        // Click the target element
        ;(targetElement as HTMLElement).click()

        // Wait a brief moment for the click to be processed, then advance
        setTimeout(() => {
          onNext()
        }, 100)
      } else {
        // Element is not a standard button, but try clicking it anyway
        // This handles clickable divs and other non-button interactive elements
        ;(targetElement as HTMLElement).click()

        // Wait a brief moment for the click to be processed, then advance
        setTimeout(() => {
          onNext()
        }, 100)
      }
    } else {
      // No click needed, just advance
      onNext()
    }
  }, [clickOnNext, targetElement, onNext])
}
