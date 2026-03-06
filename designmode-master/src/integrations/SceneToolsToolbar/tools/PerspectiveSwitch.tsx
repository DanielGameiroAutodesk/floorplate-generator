import styles from "src/integrations/SceneToolsToolbar/SceneToolsToolbar.module.pcss"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import sceneManager from "src/core/three/sceneManager"
import { HotkeyCategory, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useHotkey } from "src/core/hotkeys"
import { toolAPI } from "src/core/toolsState"
import { useTranslator } from "src/i18n"

export default function PerspectiveSwitch() {
  const t = useTranslator()
  const [perspectiveMode, setPerspectiveMode] = useState(cameraApi.getCameraSettings().type === "perspective")
  useEffect(() => {
    cameraApi.cameraEvents.addEventListener("toggle", () => {
      setPerspectiveMode(cameraApi.getCameraSettings().type === "perspective")
    })
  }, [])

  const switchPerspective = useCallback(() => {
    void cameraApi.switchPerspective()
    // Focus back to canvas in certain contexts
    if (toolAPI.currentToolSignal.peek().id == "WSRAPITool") {
      sceneManager.canvas.focus()
    }
  }, [])

  const hotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.camera.switchCameraMode),
      callback: switchPerspective,
      keyCode: "P",
      editAccessRequired: false,
      category: HotkeyCategory.Camera,
    }
  }, [switchPerspective])

  useHotkey(hotkey)

  return (
    <weave-tooltip
      text={perspectiveMode ? t(($) => $.camera.switchTo2d) : t(($) => $.camera.switchTo3d)}
      nub="down-center"
    >
      <button onClick={() => switchPerspective()} className={styles.SceneToolsButton}>
        {perspectiveMode ? (
          <forma-2d-24 className={styles.SceneToolsIcon24}></forma-2d-24>
        ) : (
          <forma-3d-24 className={styles.SceneToolsIcon24}></forma-3d-24>
        )}
      </button>
    </weave-tooltip>
  )
}
