import { useCallback, useState } from "react"

const TUTORIAL_COMPLETION_KEY = "forma-site-tutorials-completed"

// Map of tutorial ID to completion timestamp
type CompletedTutorialsMap = Record<string, number>

// Storage functions
function getCompletedTutorialsFromStorage(): CompletedTutorialsMap {
  try {
    const storedData = localStorage.getItem(TUTORIAL_COMPLETION_KEY)
    if (!storedData) return {}

    return JSON.parse(storedData) as CompletedTutorialsMap
  } catch (error) {
    console.error("Failed to load completed tutorials:", error)
    return {}
  }
}

function saveTutorialCompletion(tutorialId: string, timestamp?: number): void {
  try {
    const completedTutorials = getCompletedTutorialsFromStorage()
    completedTutorials[tutorialId] = timestamp || Date.now()
    localStorage.setItem(TUTORIAL_COMPLETION_KEY, JSON.stringify(completedTutorials))
  } catch (error) {
    console.error("Failed to save tutorial completion:", error)
  }
}

function clearTutorialCompletionFromStorage(tutorialId: string): void {
  try {
    const completedTutorials = getCompletedTutorialsFromStorage()
    delete completedTutorials[tutorialId]
    localStorage.setItem(TUTORIAL_COMPLETION_KEY, JSON.stringify(completedTutorials))
  } catch (error) {
    console.error("Failed to clear tutorial completion:", error)
  }
}

// React hook
export function useCompletedTutorials() {
  const [completedTutorials, setCompletedTutorials] = useState<CompletedTutorialsMap>(() =>
    getCompletedTutorialsFromStorage(),
  )

  // Helper to check if a tutorial is completed
  const isCompleted = useCallback(
    (tutorialId: string): boolean => {
      return tutorialId in completedTutorials
    },
    [completedTutorials],
  )

  // Mark a tutorial as complete and update state
  const markComplete = useCallback((tutorialId: string) => {
    const timestamp = Date.now()
    saveTutorialCompletion(tutorialId, timestamp)
    setCompletedTutorials((prev) => ({
      ...prev,
      [tutorialId]: timestamp,
    }))
  }, [])

  // Clear a tutorial completion (useful for testing)
  const clearCompletion = useCallback((tutorialId: string) => {
    clearTutorialCompletionFromStorage(tutorialId)
    setCompletedTutorials((prev) => {
      const updated = { ...prev }
      delete updated[tutorialId]
      return updated
    })
  }, [])

  return {
    completedTutorials,
    isCompleted,
    markComplete,
    clearCompletion,
  }
}

// Export storage functions for direct use if needed
export {
  clearTutorialCompletionFromStorage as clearTutorialCompletion,
  getCompletedTutorialsFromStorage as getCompletedTutorials,
}

// Helper function to mark a tutorial as complete (for external use)
export function markTutorialComplete(tutorialId: string): void {
  saveTutorialCompletion(tutorialId)
}

// Helper function to check if a specific tutorial is completed
export function isTutorialCompleted(tutorialId: string): boolean {
  const completedTutorials = getCompletedTutorialsFromStorage()
  return tutorialId in completedTutorials
}
