import { toolAPI } from "src/core/toolsState"
import { elementState } from "src/core/elements/ElementState"

/**
 * Creates an advanceWhen function that tracks modal open/close state
 * @param modalSignal - Signal that tracks if modal is currently open
 * @param wasOpenedSignal - Signal to track if modal was opened during this step
 */
export function createModalTrackingAdvanceWhen(
  modalSignal: { peek: () => boolean },
  wasOpenedSignal: { value: boolean },
) {
  return () => {
    const modalIsOpen = modalSignal.peek()

    // Track when modal opens
    if (modalIsOpen) {
      wasOpenedSignal.value = true
      return false
    }

    // Advance when modal closes after being opened
    const wasOpened = wasOpenedSignal.value
    if (wasOpened) {
      wasOpenedSignal.value = false
      return true
    }

    return false
  }
}

/**
 * Creates an advanceWhen function that tracks tool activation and deactivation
 * @param toolId - The ID of the tool to track
 * @param wasActivatedSignal - Signal to track if tool was activated during this step
 */
export function createToolActivationTrackingAdvanceWhen(toolId: string, wasActivatedSignal: { value: boolean }) {
  return () => {
    const currentToolId = toolAPI.currentToolSignal.peek().id
    const toolIsActive = currentToolId === toolId

    // Track if tool was activated
    if (toolIsActive && !wasActivatedSignal.value) {
      wasActivatedSignal.value = true
    }

    // Advance when tool becomes inactive after being activated
    if (!toolIsActive && wasActivatedSignal.value) {
      wasActivatedSignal.value = false
      return true
    }

    return false
  }
}

/**
 * Creates an advanceWhen function that tracks when elements are added to the scene
 * Detects when an element is placed by checking if proposal element count increased
 * @param countSignal - Signal that stores the initial element count
 */
export function createElementPlacementDetection(countSignal: { value: number | null }) {
  return () => {
    const proposalChildren = elementState.currentProposalSignal.peek().container.children
    const currentCount = proposalChildren.length

    // Capture initial count on first call
    if (countSignal.value === null) {
      countSignal.value = currentCount
      return false
    }

    // Advance when count increases (element placed)
    if (currentCount > countSignal.value) {
      countSignal.value = null // Reset for potential restart
      return true
    }

    return false
  }
}
