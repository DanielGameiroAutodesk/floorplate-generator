import { signal } from "@preact/signals"

/**
 * Signal to track if user has closed the ResourcesModal at least once
 * This prevents tutorials from appearing while the modal is still open
 */
export const isResourcesModalOpenSignal = signal<boolean>(false)

/**
 * Call this when the ResourcesModal is closed
 * Marks that the user has interacted with and closed the modal
 */
export function setResourcesModalStateSignal(state: boolean) {
  isResourcesModalOpenSignal.value = state
}
