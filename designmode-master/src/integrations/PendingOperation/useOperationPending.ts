import { useEffect } from "preact/compat"
import type { PendingOperation } from "src/core/pending-operation"
import {
  pendingOperationSignal,
  setPendingOperationPreventedActionSignalValue,
  setPendingOperationSignalValue,
} from "src/core/pending-operation"
import type { I18nStringProvider } from "src/i18n"

function setPendingOperation(op: PendingOperation | undefined) {
  setPendingOperationSignalValue(op)
  if (!op) {
    setPendingOperationPreventedActionSignalValue(undefined)
  }
}

function markOperationBlocked(description?: I18nStringProvider) {
  setPendingOperationPreventedActionSignalValue({ timestamp: Date.now(), description })
}

export const useOperationPending = () => {
  useEffect(() => {
    return () => {
      setPendingOperationSignalValue(undefined)
    }
  }, [])

  return { setPendingOperation, isOperationPending: pendingOperationSignal.value, markOperationBlocked }
}
