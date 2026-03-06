import * as THREE from "three"
import type { OrthographicCamera, PerspectiveCamera } from "three"
import { Euler, MOUSE } from "three"
import sceneManager from "./sceneManager"
import { CustomOrbitControls } from "@spacemakerai/orbit-controls-common"
import { EasingFunctions } from "src/lib/easing"

const frustrumSize = 1100
const minZoom = 0.2
const maxZoom = 500

export function updateAspectRatio(
  aspect: number,
  orthographicCamera: OrthographicCamera,
  perspectiveCamera: PerspectiveCamera,
) {
  orthographicCamera.left = (-frustrumSize * aspect) / 2
  orthographicCamera.right = (frustrumSize * aspect) / 2
  orthographicCamera.top = frustrumSize / 2
  orthographicCamera.bottom = -frustrumSize / 2
  orthographicCamera.updateProjectionMatrix()

  perspectiveCamera.aspect = aspect
  perspectiveCamera.updateProjectionMatrix()
}

export function buildCamerasAndControls(canvas: HTMLCanvasElement) {
  const orthographicCamera = new THREE.OrthographicCamera(0, 0, 0, 0, -6000, 6000)
  const perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 1, 20000)

  updateAspectRatio(canvas.width / canvas.height, orthographicCamera, perspectiveCamera)

  for (const camera of [orthographicCamera, perspectiveCamera]) {
    camera.rotation.reorder("ZXY")
    camera.layers.enableAll()
    camera.zoom = 1
    // set to same position, and look at the origin
    camera.up.set(0, 0, 1)
  }

  const controls = new CustomOrbitControls(perspectiveCamera, canvas)
  controls.minDistance = 5
  controls.maxDistance = 7000
  controls.maxPolarAngle = Math.PI
  controls.zoomSpeed = 0.8
  controls.mouseButtons.LEFT = MOUSE.PAN
  controls.mouseButtons.RIGHT = MOUSE.ROTATE
  controls.mouseButtons.MIDDLE = MOUSE.PAN
  controls.minZoom = minZoom
  controls.maxZoom = maxZoom

  return {
    orthographicCamera,
    perspectiveCamera,
    controls: controls,
  }
}

let lastPolar = Math.PI / 4

function animateSwitchToPerspective(
  perspectiveCamera: PerspectiveCamera,
  orthographicCamera: OrthographicCamera,
  controls: CustomOrbitControls,
  transitionMs: number,
  easingFunction: (alpha: number) => number = EasingFunctions.easeInOutQuart,
  syncWithRemotes = true,
) {
  return new Promise<void>((resolve) => {
    const vFOV = THREE.MathUtils.degToRad(perspectiveCamera.fov)
    const height = 2 * Math.tan(vFOV / 2) * orthographicCamera.zoom
    const newDistance = frustrumSize / height

    const orthographicRotation = orthographicCamera.rotation.z // position camera according to the z-rotation to keep this information in the position-target relation
    perspectiveCamera.position.set(
      controls.target.x + Math.sin(orthographicRotation),
      controls.target.y - Math.cos(orthographicRotation),
      controls.target.z + newDistance,
    )
    perspectiveCamera.lookAt(controls.target)

    controls.object = perspectiveCamera
    sceneManager.camera = perspectiveCamera
    controls.dispatchEvent({ type: "toggle", syncWithRemotes })

    let startTime: DOMHighResTimeStamp
    const startPolar = controls.getPolarAngle()
    const endPolar = lastPolar
    const animate = (timestamp: DOMHighResTimeStamp) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      if (elapsed < transitionMs) {
        const t = Math.min(1, easingFunction(elapsed / transitionMs))
        const targetPolar = startPolar + t * (endPolar - startPolar)
        const delta = targetPolar - controls.getPolarAngle()
        controls.rotateUp(-delta)
        controls.update(syncWithRemotes)
        window.requestAnimationFrame(animate)
      } else {
        controls.rotateUp(controls.getPolarAngle() - endPolar)
        controls.update(syncWithRemotes)

        controls.dispatchEvent({ type: "end", target: undefined })
        resolve()
      }
    }
    window.requestAnimationFrame(animate)
  })
}

function animateSwitchToOrthographic(
  perspectiveCamera: PerspectiveCamera,
  orthographicCamera: OrthographicCamera,
  controls: CustomOrbitControls,
  transitionMs: number,
  easingFunction: (alpha: number) => number,
  syncWithRemotes = true,
) {
  return new Promise<void>((resolve) => {
    const vFOV = THREE.MathUtils.degToRad(perspectiveCamera.fov) // convert vertical fov to radians
    const height = 2 * Math.tan(vFOV / 2) * perspectiveCamera.position.clone().sub(controls.target).length() // visible height

    const orthoNewPos = controls.target.clone()
    orthoNewPos.z = controls.target.z + height
    const newRotation = new Euler(
      orthographicCamera.rotation.x,
      orthographicCamera.rotation.y,
      perspectiveCamera.rotation.z,
    )

    const onAnimationComplete = () => {
      orthographicCamera.position.copy(orthoNewPos)
      orthographicCamera.lookAt(controls.target)
      orthographicCamera.rotation.copy(newRotation)

      orthographicCamera.zoom = Math.min(Math.max(frustrumSize / height, minZoom), maxZoom)
      orthographicCamera.updateProjectionMatrix()

      controls.object = orthographicCamera
      sceneManager.camera = orthographicCamera

      controls.dispatchEvent({ type: "end", target: undefined })
      controls.dispatchEvent({ type: "change", target: undefined, syncWithRemotes })
      controls.dispatchEvent({ type: "toggle", syncWithRemotes })
      controls.update(syncWithRemotes)
      resolve()
    }

    const perspectiveOrgPos = perspectiveCamera.position.clone()
    const perspectiveNewPos = orthoNewPos

    lastPolar = controls.getPolarAngle()

    let startTime: DOMHighResTimeStamp

    const animate = (timeStamp: DOMHighResTimeStamp) => {
      if (!startTime) startTime = timeStamp
      const elapsed = timeStamp - startTime
      if (elapsed < transitionMs) {
        const t = Math.min(easingFunction(elapsed / transitionMs), 1)
        perspectiveCamera.position.lerpVectors(perspectiveOrgPos, perspectiveNewPos, t)
        controls.update(syncWithRemotes)
        window.requestAnimationFrame(animate)
      } else {
        perspectiveCamera.position.copy(perspectiveNewPos)
        onAnimationComplete()
      }
    }
    window.requestAnimationFrame(animate)
  })
}

export function switchPerspective(
  transitionMs = 500,
  easingFunction: (alpha: number) => number = EasingFunctions.linear,
  syncWithRemotes = true,
) {
  const { perspectiveCamera, orthographicCamera, controls } = sceneManager

  if (sceneManager.camera === perspectiveCamera) {
    return animateSwitchToOrthographic(
      perspectiveCamera,
      orthographicCamera,
      controls,
      transitionMs,
      easingFunction,
      syncWithRemotes,
    )
  } else {
    return animateSwitchToPerspective(
      perspectiveCamera,
      orthographicCamera,
      controls,
      transitionMs,
      easingFunction,
      syncWithRemotes,
    )
  }
}
