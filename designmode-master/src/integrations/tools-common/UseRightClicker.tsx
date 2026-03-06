import { MOUSE } from "three"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"

let rightOrMiddleDown = false
let hasMovedWhileRightOrMiddleDown = false

let startX = 0
let startY = 0
const MOVED_DISTANCE = 5

export function useRightClicker() {
  useEventHandler(
    "mousedown",
    (e) => {
      // Execute camera pan with middle or shift-right mouse buttons
      rightOrMiddleDown = e.button === MOUSE.RIGHT || e.button === MOUSE.MIDDLE
      if (!rightOrMiddleDown) sceneManager.controls.enabled = false
      startX = e.clientX
      startY = e.clientY
      return Propagate.YES
    },
    Priority.ORBIT,
    sceneManager.renderer.domElement,
  )

  useEventHandler(
    "mousemove",
    (e: MouseEvent) => {
      const distance = Math.sqrt(Math.pow(startX - e.clientX, 2) + Math.pow(startY - e.clientY, 2))
      if (rightOrMiddleDown) hasMovedWhileRightOrMiddleDown = distance > MOVED_DISTANCE
      return rightOrMiddleDown ? Propagate.NO : Propagate.YES
    },
    Priority.ORBIT,
    sceneManager.renderer.domElement,
  )

  // Handler for double click with middle mouse button. This will execute zoom to fit
  useEventHandler(
    "mouseup",
    () => {
      sceneManager.controls.enabled = true
      rightOrMiddleDown = false

      if (hasMovedWhileRightOrMiddleDown) {
        hasMovedWhileRightOrMiddleDown = false
        return Propagate.NO
      }
      return Propagate.YES
    },
    Priority.ORBIT,
    sceneManager.renderer.domElement,
  )
  return null
}
