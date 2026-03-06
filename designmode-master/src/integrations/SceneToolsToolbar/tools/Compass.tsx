import { useCallback, useEffect, useRef } from "preact/hooks"
import sceneManager from "src/core/three/sceneManager"
import { toolAPI } from "src/core/toolsState"
import { useTranslator } from "src/i18n"

function setCameraTheta(theta: number) {
  const controls = sceneManager.controls
  const delta = theta - controls.getAzimuthalAngle()
  controls.rotateLeft(-delta)
  controls.update()
}

function easingFunction(from: number, to: number, alpha: number) {
  const val = (alpha = alpha / 1 - 1) * alpha * alpha * alpha * alpha + 1
  return (1 - val) * from + val * to
}

function rotateToNorth() {
  const controls = sceneManager.controls
  const startTheta = controls.getAzimuthalAngle()
  let startTime: DOMHighResTimeStamp
  const distFromNorth = Math.abs(startTheta) / Math.PI
  const duration = 750 * distFromNorth

  const animate = (timestamp: DOMHighResTimeStamp) => {
    if (!startTime) startTime = timestamp
    const elapsed = timestamp - startTime
    if (elapsed < duration) {
      const factor = Math.min(elapsed / duration, 1)
      setCameraTheta(easingFunction(startTheta, 0, factor))
      window.requestAnimationFrame(animate)
    } else {
      setCameraTheta(0)
      controls.dispatchEvent({ type: "end", target: undefined })
    }
  }
  if (distFromNorth) window.requestAnimationFrame(animate)
}

export default function Compass() {
  const t = useTranslator()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    function updateTransform() {
      const angle = sceneManager.controls?.getAzimuthalAngle() || 0
      ref.current!.setAttribute("angle", String(angle))
    }
    updateTransform()
    const controls = sceneManager.controls
    controls.addEventListener("change", updateTransform)
    return () => controls.removeEventListener("change", updateTransform)
  }, [])

  const rotateNorth = useCallback(() => {
    rotateToNorth()
    // Focus back to canvas in certain contexts
    if (toolAPI.currentToolSignal.peek().id == "WSRAPITool") {
      sceneManager.canvas.focus()
    }
  }, [])

  return (
    <weave-tooltip text={t(($) => $.camera.compass)}>
      <forma-compass dock ref={ref} onClick={rotateNorth} />
    </weave-tooltip>
  )
}
