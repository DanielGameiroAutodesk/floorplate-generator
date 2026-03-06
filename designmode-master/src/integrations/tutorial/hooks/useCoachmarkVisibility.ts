import { useCallback, useState } from "react"
import { usePolling } from "./usePolling"
import { toolAPI } from "src/core/toolsState"

/**
 * Hook to determine if coachmark should be hidden based on conditions.
 * Monitors tool activation and DOM element existence.
 */
export function useCoachmarkVisibility(hideCoachmarkWhileToolActive?: string, hideWhileElementExists?: string) {
  // Check if tool is currently active (used to hide coachmark while user is using the tool)
  const isToolActive = hideCoachmarkWhileToolActive
    ? toolAPI.currentToolSignal.value.id === hideCoachmarkWhileToolActive
    : false

  // Monitor hideWhileElementExists and trigger re-renders when element appears/disappears
  const [elementExists, setElementExists] = useState(false)
  const checkElement = useCallback(() => {
    if (!hideWhileElementExists) return
    const exists = !!document.querySelector(hideWhileElementExists)
    setElementExists(exists)
  }, [hideWhileElementExists])

  usePolling(checkElement, !!hideWhileElementExists)

  // Determine if coachmark should be hidden
  const shouldHideCoachmark =
    (hideCoachmarkWhileToolActive && isToolActive) || (hideWhileElementExists && elementExists)

  return shouldHideCoachmark
}
