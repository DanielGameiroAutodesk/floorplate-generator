import type { Camera, Ray } from "three"
import { Raycaster, Vector2 } from "three"
import { useEffect } from "preact/compat"
import sceneManager from "./three/sceneManager"

const updateRay = (
  mouseEvent: MouseEvent,
  domElement: HTMLElement,
  camera: Camera,
  targetRaycaster: Raycaster,
): Ray => {
  const rect = domElement.getBoundingClientRect()
  const x = (mouseEvent.clientX - rect.left) / rect.width
  const y = (mouseEvent.clientY - rect.top) / rect.height
  const pointerVector = new Vector2(x * 2 - 1, -(y * 2) + 1)
  targetRaycaster.setFromCamera(pointerVector, camera)
  return targetRaycaster.ray
}

export const mousePosition = new Raycaster()
export let mouseScreenPosition: { x: number; y: number } = { x: 0, y: 0 }

mousePosition.setFromCamera(new Vector2(0, 0), sceneManager.camera)
mousePosition.params.Line = { threshold: 5 }
mousePosition.params.Line2 = { threshold: 5 }
mousePosition.params.Points = { threshold: 3 }

export default function useMousePosition() {
  useEffect(() => {
    function mousemove(e: MouseEvent) {
      updateRay(e, sceneManager.canvas, sceneManager.camera, mousePosition)
      mouseScreenPosition = { x: e.clientX, y: e.clientY }
    }
    let previous = { x: 0, y: 0 }
    function dragover(e: MouseEvent) {
      e.preventDefault()
      if (previous.x === e.x && previous.y === e.y) return
      previous = { x: e.x, y: e.y }
      return mousemove(e)
    }
    sceneManager.canvas.addEventListener("mousemove", mousemove)
    sceneManager.canvas.addEventListener("dragover", dragover)
    return () => {
      sceneManager.canvas.removeEventListener("mousemove", mousemove)
      sceneManager.canvas.removeEventListener("dragover", dragover)
    }
  }, [])
}
