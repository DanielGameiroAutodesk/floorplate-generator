import { useEffect } from "react"
import { markTutorialAsShown } from "./closeTutorial"

const TUTORIAL_INTERCOM_TOUR_ID = 641399

/**
 * Component that starts the Intercom tutorial tour when mounted.
 * Automatically cleans up polling if the component unmounts before Intercom loads.
 */
const IntercomTutorial = () => {
  useEffect(() => {
    const triggerTour = () => {
      window.Intercom("startTour", TUTORIAL_INTERCOM_TOUR_ID)
      markTutorialAsShown()
    }

    // Check if Intercom is already available
    if (window.Intercom) {
      triggerTour()
      return
    }

    // Poll for Intercom availability (check every 100ms for up to 5 seconds)
    let attempts = 0
    const maxAttempts = 50 // 50 * 100ms = 5 seconds
    const interval = setInterval(() => {
      attempts++
      if (window.Intercom) {
        clearInterval(interval)
        triggerTour()
      } else if (attempts >= maxAttempts) {
        clearInterval(interval)
        console.warn("Intercom not available after 5 seconds")
      }
    }, 100)

    // Cleanup function to clear interval if component unmounts
    return () => clearInterval(interval)
  }, [])

  return null
}

export default IntercomTutorial
