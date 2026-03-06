import { useEffect, useState } from "preact/hooks"
import sceneManager from "./sceneManager"

export default function useIs2D() {
  const [is2d, setIs2d] = useState(sceneManager.camera === sceneManager.orthographicCamera)
  useEffect(() => {
    const onChange = () => setIs2d(sceneManager.camera === sceneManager.orthographicCamera)
    sceneManager.controls.addEventListener("change", onChange)
    return () => sceneManager.controls.removeEventListener("change", onChange)
  }, [])
  return is2d
}
