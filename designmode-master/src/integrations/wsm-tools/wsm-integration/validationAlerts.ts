import { effect } from "@preact/signals"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { validationErrorTexts, type ValidationError } from "src/core/elements/validation/geometry-validation/errors"
import debounce from "lodash/debounce"
import {
  wsmCurrentValidationErrorsSignal,
  wsmIsNotSketchOrDragToolActiveSignal,
  wsmPreviousValidationErrorsSignal,
} from "src/integrations/wsm-tools/wsr/integrated/state"

// Initialize WSM validation alerts handling (includes analytics tracking)
// Returns a cleanup function that should be called when no longer needed
export function initWSMValidationAlerts() {
  // Debounced function to update validation errors and analytics
  const debouncedUpdateErrors = debounce((currentErrors: ValidationError[]) => {
    const previousErrors = wsmPreviousValidationErrorsSignal.value

    // Find new errors that are not present in the previous list
    const newErrors = currentErrors.filter(
      (newError) =>
        !previousErrors.some((prevError) => prevError.type === newError.type && prevError.path === newError.path),
    )

    // Track analytics for each new error type
    newErrors.forEach((error) => {
      const subFeature = validationErrorTexts[error.type].analyticsSubfeature || "Unknown error type"
      Analytics.track(EventName.Use, {
        feature_category: FeatureCategory.DesignTool,
        feature: "3dSketch",
        sub_feature: subFeature,
      })
    })

    // Update the validation errors to be shown
    wsmPreviousValidationErrorsSignal.value = currentErrors
  }, 100)

  const disposeEffect = effect(() => {
    const currentErrors = wsmCurrentValidationErrorsSignal.value
    const previousErrors = wsmPreviousValidationErrorsSignal.value
    const isNotSketchingOrDragging = wsmIsNotSketchOrDragToolActiveSignal.value
    const hasFewerErrors = currentErrors.length < previousErrors.length

    // Always show improvements immediately
    if (hasFewerErrors) {
      debouncedUpdateErrors.cancel() // Cancel any pending debounced update
      debouncedUpdateErrors(currentErrors) // Update immediately
    }
    // Debounce updates when not sketching/dragging to avoid rapid tool transitions
    else if (isNotSketchingOrDragging) {
      debouncedUpdateErrors(currentErrors)
    } else {
      // Cancel debounced updates when actively sketching/dragging
      debouncedUpdateErrors.cancel()
    }
  })

  // Return cleanup function
  return () => {
    debouncedUpdateErrors.cancel()
    disposeEffect()
  }
}
