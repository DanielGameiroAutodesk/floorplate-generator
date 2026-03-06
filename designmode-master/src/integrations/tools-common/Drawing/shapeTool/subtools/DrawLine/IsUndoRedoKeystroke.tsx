import { isOnMac } from "src/lib/measurementSystem"

export function isUndoRedoKeystroke(event: KeyboardEvent) {
  if (isOnMac) {
    if (event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey)) {
      if (event.shiftKey) {
        return "redo"
      } else {
        return "undo"
      }
    }
  } else {
    if (event.key.toLowerCase() === "z" && event.ctrlKey) {
      return "undo"
    } else if (event.key.toLowerCase() === "y" && event.ctrlKey) {
      return "redo"
    }
  }
  return undefined
}
