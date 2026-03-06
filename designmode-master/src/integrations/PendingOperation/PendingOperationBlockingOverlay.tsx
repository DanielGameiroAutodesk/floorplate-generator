import type { JSX } from "preact/compat"
import styles from "./PendingOperationBlockingOverlay.module.pcss"
import { useCallback } from "preact/hooks"
import { pendingOperationSignal, setPendingOperationPreventedActionSignalValue } from "src/core/pending-operation"
import type { I18nStringProvider } from "src/i18n"

/**
 * Disables any children and fades them to 50% opacity if there is a pending operation.
 * Triggers the pending operation popup if clicked when disabled
 */
export const PendingOperationBlockingOverlay = ({
  children,
  description,
}: {
  children: JSX.Element | JSX.Element[]
  description: I18nStringProvider
}) => {
  const interceptClick = useCallback(
    (e: MouseEvent) => {
      if (!pendingOperationSignal.peek()) return
      e.preventDefault()
      setPendingOperationPreventedActionSignalValue({
        timestamp: Date.now(),
        description,
      })
    },
    [description],
  )

  //TODO: make children have pointerevent:none if pending
  return (
    <div
      className={[styles.Overlay, pendingOperationSignal.value ? styles.pending : ""].join(" ")}
      onClick={interceptClick}
    >
      {children}
    </div>
  )
}
