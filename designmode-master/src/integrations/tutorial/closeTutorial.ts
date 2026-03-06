import { signal } from "@preact/signals"

const TUTORIALS_SHOWN_KEY = "forma-site-tutorials-shown"

// Signal to control tutorial panel visibility (opened via button)
export const isTutorialPanelOpenSignal = signal<boolean>(false)

export function closeTutorial(persist: boolean = true) {
  if (persist) {
    markTutorialAsShown()
  }
}

export function markTutorialAsShown() {
  localStorage.setItem(TUTORIALS_SHOWN_KEY, "true")
}

export function toggleTutorialPanel() {
  isTutorialPanelOpenSignal.value = !isTutorialPanelOpenSignal.peek()
}

export function closeTutorialPanel() {
  isTutorialPanelOpenSignal.value = false
}
