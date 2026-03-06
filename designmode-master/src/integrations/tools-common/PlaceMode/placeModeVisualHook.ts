import { atom, useRecoilValue, useResetRecoilState, useSetRecoilState } from "recoil"
import { tempSidebarsCollapsed } from "src/integrations/sidebar/sidebarsState"
import { useEffect, useLayoutEffect } from "preact/compat"
import { Color } from "three"
import sceneManager, { SCENE_BACKGROUND_COLOR } from "src/core/three/sceneManager"
import { useExitPlaceMode } from "./resourcesHooks"

export const placeModeVisualsActiveState = atom<boolean>({ key: "place-mode-active", default: false })

export function dimTerrain() {
  const mat = sceneManager.overlay.material
  mat.uniforms.fade.value = 0.4
  sceneManager.scene.background = new Color(0x555555)
  sceneManager.render(false, true)

  return () => {
    mat.uniforms.fade.value = 0
    sceneManager.scene.background = SCENE_BACKGROUND_COLOR
    sceneManager.render(false, true)
  }
}

export function useDimTerrain(active: boolean = true) {
  useLayoutEffect(() => {
    if (active) {
      return dimTerrain()
    }
  }, [active])
}

export function useHideSidebars(active: boolean = true) {
  const setSidebars = useSetRecoilState(tempSidebarsCollapsed)
  const resetSidebars = useResetRecoilState(tempSidebarsCollapsed)

  useLayoutEffect(() => {
    if (active) {
      setSidebars((p) => (p ? { ...p, left: true, right: true } : { left: true, right: true }))
      return () => {
        resetSidebars()
      }
    }
  }, [active, resetSidebars, setSidebars])
}

export function usePlaceModeSceneVisuals() {
  const exitPlaceMode = useExitPlaceMode()
  const placeModeActive = useRecoilValue(placeModeVisualsActiveState)

  useDimTerrain(placeModeActive)
  useHideSidebars(placeModeActive)

  useEffect(() => {
    function exit(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Backspace") {
        exitPlaceMode()
        return
      }
    }

    if (placeModeActive) {
      window.addEventListener("keydown", exit)
      return () => {
        window.removeEventListener("keydown", exit)
      }
    }
  }, [exitPlaceMode, placeModeActive])
}
