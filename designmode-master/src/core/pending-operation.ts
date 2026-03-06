import type { I18nStringProvider } from "src/i18n"
import { explicitSignal } from "src/lib/signal"

export type PendingOperation = {
  description?: I18nStringProvider
  elementId?: string
}

export type PreventedAction = {
  description?: I18nStringProvider
  timestamp: number
}

export const [pendingOperationPreventedActionSignal, setPendingOperationPreventedActionSignalValue] = explicitSignal<
  PreventedAction | undefined
>(undefined)

/**
 * Information about pending operation - will block users from performing certain operations, like changing selection or activating tools.
 * Introduced to support 3rd party generators.
 * Can be removed when/if the core state is made to support pending data in the element tree.
 */
export const [pendingOperationSignal, setPendingOperationSignalValue] = explicitSignal<PendingOperation | undefined>(
  undefined,
)
