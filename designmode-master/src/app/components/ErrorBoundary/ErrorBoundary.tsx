import { useEffect } from "preact/compat"
import { useErrorBoundary } from "preact/hooks"
import { resetHoveredIdsSignal, resetSelectionSetSignal } from "src/core/selection/selectionState"
import { captureException } from "@sentry/browser"
import { emitGlobalError } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { IgnoreContext } from "src/core/ignore-context"
import type { ComponentChildren } from "preact"
import { GlobalError } from "./GlobalError"
import { cancelLongSaveTimeDetector } from "src/core/elements-saving/long-save-time-detector"
import { toolAPI } from "src/core/toolsState"
import { globalErrorSignal, setGlobalErrorSignalValue } from "src/core/global-errors"
import { getTranslator } from "src/i18n"

const KNOWN_THIRD_PARTY_ERRORS = [
  // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors
  "ResizeObserver loop completed with undelivered notifications.", // (visual-compare)
]

export const KNOWN_CRITICAL_ERRORS = {
  TOPLEVEL_ERROR: "TOPLEVEL_ERROR",
} as const

export function dispatchCriticalError<T extends keyof typeof KNOWN_CRITICAL_ERRORS>(
  type: (typeof KNOWN_CRITICAL_ERRORS)[T],
  error: any,
) {
  window.dispatchEvent(new ErrorEvent("error", { error, message: type }))
}

export default function ErrorBoundary({ children }: { children: ComponentChildren }) {
  useGlobalErrorBoundary()

  const globalError = globalErrorSignal.value
  if (globalError) {
    document.querySelector<HTMLElement>("forma-bootstrap")?.removeAttribute("halt-non-essentials")
    return <GlobalError error={globalError} />
  }

  return <>{children}</>
}

function errorHandler(e: PromiseRejectionEvent | ErrorEvent | any) {
  // UDA picker is throwing async errors that we are not able to capture ATM
  if (
    e instanceof ErrorEvent &&
    e.filename?.includes("forma-docs-file-picker") &&
    e.message.includes("No row with id")
  ) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  const handled = emitGlobalError(e)

  const message = e instanceof ErrorEvent ? e.message : e instanceof PromiseRejectionEvent ? e.reason : e.message
  if (message in KNOWN_CRITICAL_ERRORS) {
    setGlobalErrorSignalValue(e)
    cancelLongSaveTimeDetector()
  } else if (!handled && !KNOWN_THIRD_PARTY_ERRORS.includes(message)) {
    toolAPI.resetTool()
    resetSelectionSetSignal()
    resetHoveredIdsSignal()
    IgnoreContext.reset()
    const t = getTranslator()
    const content = t(($) => $.errorBoundary.unexpectedError)
    window.forma_toasts.push({ content: content, status: "error" })
  }

  console.error(e)
}

function useGlobalErrorBoundary() {
  useEffect(() => {
    window.addEventListener("error", errorHandler)
    window.addEventListener("unhandledrejection", errorHandler)
    return () => {
      window.removeEventListener("error", errorHandler)
      window.removeEventListener("unhandledrejection", errorHandler)
    }
  }, [])

  const [error, resetError] = useErrorBoundary((error, errorInfo) => {
    console.error("Caught in 'useErrorBoundary'", error, errorInfo)
  })

  if (error) {
    captureException(error)
    resetError()
    errorHandler(error)
  }
}
