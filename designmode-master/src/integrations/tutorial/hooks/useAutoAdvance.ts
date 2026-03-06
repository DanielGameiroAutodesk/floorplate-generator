import { useCallback } from "react"
import { usePolling } from "./usePolling"

/**
 * Hook to monitor a condition and auto-advance when it becomes true.
 * Polls the condition function and calls onNext when condition is met.
 */
export function useAutoAdvance(advanceWhen: (() => boolean) | undefined, onNext: () => void) {
  const checkCondition = useCallback(() => {
    if (!advanceWhen) return

    const conditionMet = advanceWhen()
    if (conditionMet) {
      onNext()
    }
  }, [advanceWhen, onNext])

  usePolling(checkCondition, !!advanceWhen)
}
