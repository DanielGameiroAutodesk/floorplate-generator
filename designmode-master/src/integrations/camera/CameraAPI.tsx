import sceneManager, { storeCameraPos } from "src/core/three/sceneManager"
import type { BaseEvent, EventDispatcher, EventListener } from "three"
import { OrthographicCamera, PerspectiveCamera, Vector2, Vector3 } from "three"
import { EasingFunctions } from "src/lib/easing"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import type { ComponentChild } from "preact"
import { render } from "preact"
import { switchPerspective } from "src/core/three/controls"
import HUD from "src/integrations/hud/HUD"
import { nextFrame } from "src/lib/nextFrame"
import debounce from "lodash/debounce"

type Vec3 = { x: number; y: number; z: number }
type Vec2 = { x: number; y: number }

type CameraState = {
  position: Vec3
  direction: Vec3
  up: Vec3
  target: Vec3
  orthoFrustumHeight: number
}

type CameraSettings =
  | {
      type: "perspective"
      fov: number
      aspect: number
    }
  | {
      type: "orthographic"
      zoom: number
      theta: number
    }

type EasingFunction = (t: number) => number

/**
 * API for controlling the cameras in design mode
 */
export type CameraAPI = {
  /**
   * Move the camera to a specific position and direction
   * @param position new position of camera
   * @param target lookAt target for camera - only affects perspective camera. If undefined, the direction of the camera is preserved.
   * @param zoom new zoom value - only affects orhographic camera
   * @param transitionTimeMs transition time, defaults to 0 for instant movement
   * @param easingFunction easing function for the transition. Defaults to EasingFunctions.easeOutQuart
   * @param theta angle around z-axis for orthographic (2d) camera
   * @return resolves on animation complete
   */
  moveCamera(
    this: void,
    position: Vec3,
    target?: Vec3,
    zoom?: number,
    transitionTimeMs?: number,
    easingFunction?: EasingFunction,
    syncWithRemotes?: boolean,
    theta?: number,
  ): Promise<void>

  /**
   * Returns the current camera position and direction
   */
  getCurrentCameraState(this: void): CameraState

  /**
   * Calculates how many meters will take up a certain amount of pixels when drawn at a specific position.
   * Usually used to make objects in the 3D scene appear to have a certain size on screen.
   *
   * @param pixels
   * @param position
   */
  pixelsToMetersAtPosition(this: void, pixels: number, position: Vec3): number

  /**
   * Returns certain settings for the current camera
   */
  getCameraSettings(this: void): CameraSettings

  /**
   * Returns the screen position of a position in space by projecting the position using the current camera
   * @param worldPosition
   */
  worldToScreen(this: void, worldPosition: Vec3): Vec2

  /**
   * Switches between orthographic and perspective mode
   * @param transitionTimeMs time to spend animating the switch. Defaults to 500ms
   * @param easingFunction to use for animation. Defaults to linear.
   * @return resolves on animation complete
   */
  switchPerspective(
    this: void,
    transitionTimeMs?: number,
    easingFunction?: EasingFunction,
    syncWithRemotes?: boolean,
  ): Promise<void>

  /**
   * Capture the current screen
   *
   * @param ctx the context to place the results in
   * @param width optional width of screen size
   * @param height optional height of screen size
   *
   */
  EXPERIMENTAL_captureScreen(this: void, ctx: CanvasRenderingContext2D, width?: number, height?: number): Promise<void>

  /**
   * Event dispatcher for camera events, enabling integrations to act on camera changes.
   */
  cameraEvents: Pick<EventDispatcher<CameraEventMap>, "addEventListener" | "removeEventListener">
}

type CameraEventType = "change" | "toggle"
type CameraChangeEvent = BaseEvent & { type: CameraEventType }
type CameraEventMap = Record<CameraEventType, CameraChangeEvent>

const originalCameraPos = new Vector3()
const originalTargetPos = new Vector3()
const newCameraPosition = new Vector3()
const newTargetPosition = new Vector3()
const animationPosCamera = new Vector3()
const animationPosTarget = new Vector3()

function moveCamera(
  position: Vec3,
  target?: Vec3,
  zoom?: number,
  transitionTimeMs = 0,
  easingFunction = EasingFunctions.easeOutQuart,
  syncWithRemotes = true,
  theta?: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const { camera, controls } = sceneManager

    const { x, y, z } = position
    originalCameraPos.copy(camera.position)
    newCameraPosition.set(x, y, z)
    const start = Date.now()
    const {
      x: tx,
      y: ty,
      z: tz,
    } = target || camera.getWorldDirection(new Vector3()).multiplyScalar(100).add(originalCameraPos)
    originalTargetPos.copy(controls.target)
    newTargetPosition.set(tx, ty, tz)

    if (camera instanceof PerspectiveCamera) {
      const animate = () => {
        const elapsed = Date.now() - start
        const t = Math.min(transitionTimeMs > 0 ? elapsed / transitionTimeMs : 1, 1)
        const alpha = easingFunction(t)

        animationPosCamera.lerpVectors(originalCameraPos, newCameraPosition, alpha)
        camera.position.copy(animationPosCamera)
        target && controls.target.copy(newTargetPosition)

        animationPosTarget.lerpVectors(originalTargetPos, newTargetPosition, alpha)
        controls.target.copy(animationPosTarget)

        camera.updateProjectionMatrix()
        controls.update(syncWithRemotes)
        sceneManager.render()
        if (t < 1) {
          window.requestAnimationFrame(animate)
        } else {
          storeCameraPos()
          resolve()
        }
      }
      window.requestAnimationFrame(animate)
    } else if (camera instanceof OrthographicCamera) {
      const currentZoom = camera.zoom
      const targetZoom = new Vector3(zoom || currentZoom)
      const startZoom = new Vector3(currentZoom)
      const animate = () => {
        const elapsed = Date.now() - start
        const t = Math.min(transitionTimeMs > 0 ? elapsed / transitionTimeMs : 1, 1)
        const alpha = easingFunction(t)

        animationPosCamera.lerpVectors(originalCameraPos, newCameraPosition, alpha)
        controls.object.position.copy(animationPosCamera)

        animationPosTarget.lerpVectors(originalTargetPos, newTargetPosition, alpha)
        controls.target.copy(animationPosTarget)

        const animZoom = new Vector3().lerpVectors(startZoom, targetZoom, alpha)
        camera.zoom = animZoom.x
        camera.updateProjectionMatrix()

        controls.update(syncWithRemotes)
        sceneManager.render()
        if (t < 1) {
          window.requestAnimationFrame(animate)
        } else {
          if (theta !== undefined) camera.rotation.set(0, 0, theta)
          storeCameraPos()
          resolve()
        }
      }
      window.requestAnimationFrame(animate)
    }
  })
}

function setSceneSize({ width, height }: { width: number; height: number; hud?: HTMLDivElement }) {
  const { scene, camera, renderer, controls } = sceneManager
  if (camera instanceof PerspectiveCamera) {
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  } else if (camera instanceof OrthographicCamera) {
    const frustumSize = camera.top - camera.bottom
    const aspect = width / height
    camera.left = (-frustumSize * aspect) / 2
    camera.right = (frustumSize * aspect) / 2
    camera.top = frustumSize / 2
    camera.bottom = -frustumSize / 2
    camera.updateProjectionMatrix()
  }
  controls.dispatchEvent({ type: "change" })
  renderer.setSize(width / window.devicePixelRatio, height / window.devicePixelRatio)
  renderer.render(scene, camera)
}

async function renderPreactToCanvas(vnode: ComponentChild, width: number, height: number): Promise<HTMLCanvasElement> {
  const iframe = document.createElement("iframe")
  iframe.style.width = "100vw"
  iframe.style.height = "100vh"
  iframe.style.border = "none"
  document.body.appendChild(iframe)
  if (!iframe.contentDocument) throw new Error("iframe contentDocument is null")
  iframe.contentDocument.head.innerHTML = document.head.innerHTML // to copy styles
  render(vnode, iframe.contentDocument.body)

  await nextFrame()

  const { default: html2canvas } = await import("html2canvas")
  try {
    const canvas = await html2canvas(iframe.contentDocument.getElementById("hud")!, {
      backgroundColor: null,
      windowWidth: width / window.devicePixelRatio,
      windowHeight: height / window.devicePixelRatio,
      width: width,
      height: height,
    })
    iframe.remove()
    return canvas
  } catch (e) {
    iframe.remove()
    throw e
  }
}

const addOverlay = () => {
  window.globalCanvasScreenshotOverlay.start()
  window.globalLoadingOverlay.start()
  window.globalSpinner.start()
}

const removeOverlay = debounce(() => {
  window.globalCanvasScreenshotOverlay.stop()
  window.globalLoadingOverlay.stop()
  window.globalSpinner.stop()
  // 2_000 ms to not blink when doing multiple screenshots in a row (Shadow study extension)
}, 2_000)

async function captureScreen(ctx: CanvasRenderingContext2D, width?: number, height?: number) {
  addOverlay()

  const originalSize = { width: sceneManager.canvas.width, height: sceneManager.canvas.height }
  const hud = (document.getElementById("hud") as HTMLDivElement) ?? undefined
  if (width && height) {
    setSceneSize({ width: width, height: height })
  }
  ctx.drawImage(sceneManager.canvas, 0, 0)

  if (hud && width && height) {
    const scale = Math.max(width, height) / Math.max(window.innerHeight, window.innerWidth)
    // render HUD to canvas
    const canvas = await renderPreactToCanvas(<HUD scale={scale} />, width, height)
    // draw HUD on top of scene
    ctx.drawImage(canvas, 0, 0)
  }

  if (width && height) {
    setSceneSize({ width: originalSize.width, height: originalSize.height })
  }

  removeOverlay()
}

const cameraEvents: Pick<EventDispatcher<CameraEventMap>, "addEventListener" | "removeEventListener"> = {
  addEventListener: (type: CameraEventType, listener: EventListener<any, CameraEventType, any>) =>
    sceneManager.controls.addEventListener(type, listener),
  removeEventListener: (type: CameraEventType, listener: EventListener<any, CameraEventType, any>) =>
    sceneManager.controls.removeEventListener(type, listener),
}

function getCurrentCameraState(): CameraState {
  let frustumHeight = 0
  if (sceneManager.camera instanceof OrthographicCamera) {
    frustumHeight = sceneManager.camera.top - sceneManager.camera.bottom
  }

  return {
    position: sceneManager.camera.position,
    direction: sceneManager.camera.getWorldDirection(new Vector3()),
    up: new Vector3(
      sceneManager.camera.matrixWorld.elements[4],
      sceneManager.camera.matrixWorld.elements[5],
      sceneManager.camera.matrixWorld.elements[6],
    ),
    target: sceneManager.controls.target,
    orthoFrustumHeight: frustumHeight,
  }
}

const reusedVector3 = new Vector3()
const reusedVector2 = new Vector2()

function worldToScreen({ x, y, z }: Vec3): Vec2 {
  let projPoint = reusedVector3.set(x, y, z).project(sceneManager.camera)
  let width = sceneManager.canvas.clientWidth,
    height = sceneManager.canvas.clientHeight
  let widthHalf = width / 2,
    heightHalf = height / 2
  reusedVector2.set(projPoint.x * widthHalf + widthHalf, projPoint.y * heightHalf + heightHalf)
  return { x: reusedVector2.x, y: reusedVector2.y }
}

export const cameraApi: CameraAPI = {
  moveCamera,
  getCurrentCameraState,
  pixelsToMetersAtPosition: (pixels, { x, y, z }) =>
    pixelsToMetersAtPosition(pixels, sceneManager.camera, new Vector3(x, y, z)),
  getCameraSettings: () => {
    const camera = sceneManager.camera
    if (camera instanceof PerspectiveCamera) {
      return {
        type: "perspective",
        aspect: camera.aspect,
        fov: camera.fov,
      }
    } else if (camera instanceof OrthographicCamera) {
      return {
        type: "orthographic",
        zoom: camera.zoom,
        theta: camera.rotation.z,
      }
    }
    throw new Error("Unknown camera type")
  },
  worldToScreen,
  switchPerspective,
  EXPERIMENTAL_captureScreen: captureScreen,
  cameraEvents,
}

const _vec = new Vector3()

export function pixelsToMetersAtPositionStatic(pixels: number, position: { x: number; y: number; z: number }) {
  _vec.set(position.x, position.y, position.z)
  return pixelsToMetersAtPosition(pixels, sceneManager.camera, _vec)
}
