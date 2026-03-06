import { explicitSignal } from "src/lib/signal"

/**
 * Open/close context menu. Passing undefined closes the menu.
 */
export const [contextMenuPositionSignal, setContextMenuPositionSignalValue] = explicitSignal<
  [number, number] | undefined
>(undefined)
