import { Vector3 } from "three"
import sceneManager from "./sceneManager"

const listenFor = new Set(["arrowleft", "arrowright", "arrowup", "arrowdown", "shift"])

export function activateKeyboardControls() {
  const keys = new Set<string>()
  const dir = new Vector3()
  const cameraForward = new Vector3()
  const cameraLeft = new Vector3()
  const cameraDown = new Vector3()
  const cameraUp = new Vector3()
  const cameraRight = new Vector3()

  let animate = false
  let last: number | undefined = undefined
  function loop(t: number) {
    if (keys.size === 0 || (keys.size === 1 && keys.has("shift"))) {
      animate = false
      sceneManager.controls.dispatchEvent({ type: "end", target: undefined })
      return
    }
    const left = keys.has("arrowleft")
    const right = keys.has("arrowright")
    const back = keys.has("arrowdown")
    const forward = keys.has("arrowup")
    const shift = keys.has("shift")

    const delta = last === undefined ? 0 : t - last
    last = t
    const camera = sceneManager.camera

    camera.getWorldDirection(cameraForward)
    cameraLeft.crossVectors(camera.up, cameraForward).normalize()
    cameraUp.copy(camera.up).multiplyScalar(0.5)
    cameraDown.copy(cameraUp).multiplyScalar(-1)
    cameraRight.copy(cameraLeft).multiplyScalar(-1)

    if (back) dir.add(cameraForward.clone().multiplyScalar(-1))
    if (forward) dir.add(cameraForward)
    if (left) dir.add(cameraLeft)
    if (right) dir.add(cameraRight)

    dir.setZ(0)
    dir.normalize()
    dir.multiplyScalar((shift ? 0.1 : 0.05) * delta)

    sceneManager.camera.position.add(dir)
    sceneManager.controls.target.add(dir)
    sceneManager.controls.dispatchEvent({ type: "change", target: undefined })
    requestAnimationFrame(loop)
  }

  function keydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const actualKey = e.key?.toLowerCase()
    if (window.__SUBMODE_WITH_OWN_SCENE_ACTIVE__ || e.target !== sceneManager.canvas || !listenFor.has(actualKey))
      return
    keys.add(actualKey)
    if (!animate && !(keys.size === 1 && keys.has("shift"))) {
      animate = true
      last = undefined
      requestAnimationFrame(loop)
    }
  }

  function keyup(e: KeyboardEvent) {
    const actualKey = e.key?.toLowerCase()
    if (window.__SUBMODE_WITH_OWN_SCENE_ACTIVE__ || e.target !== sceneManager.canvas || !listenFor.has(actualKey))
      return
    keys.delete(actualKey)
  }

  window.addEventListener("keydown", keydown)
  window.addEventListener("keyup", keyup)
}
