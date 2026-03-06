import { useEffect } from "react"

/**
 * Custom hook to poll a callback function at regular intervals.
 * Useful for monitoring conditions that need periodic checking.
 *
 * @param callback - Function to call on each poll
 * @param enabled - Whether polling is active
 * @param interval - Polling interval in milliseconds (default: 300ms)
 */
export function usePolling(callback: () => void, enabled: boolean, interval = 300) {
  useEffect(() => {
    if (!enabled) return

    // Check immediately
    callback()

    // Then poll at specified interval
    const intervalRef = setInterval(callback, interval)

    return () => {
      clearInterval(intervalRef)
    }
  }, [callback, enabled, interval])
}
