import type { Object3D, Scene } from "three"
import { BufferGeometry } from "three"
import sceneManager from "./sceneManager"
import { useLayoutEffect } from "preact/compat"

function hasGeometry(object: Object3D): object is Object3D & { geometry: BufferGeometry } {
  return "geometry" in object && object.geometry instanceof BufferGeometry
}

export function dispose(object: Object3D) {
  if (object?.children?.length > 0) {
    object.children.forEach(dispose)
  }
  if (hasGeometry(object)) {
    object.geometry.dispose()
  }
}

/** @deprecated Use the less deprecated RenderAPI.useObjectLifecycle
 * LOL
 * */
export function useObjectLifecycle(
  object?: Object3D,
  visible = true,
  scene: Scene = sceneManager.scene,
  updateShadowMap = true,
) {
  useLayoutEffect(() => {
    if (object) {
      scene.add(object)
      sceneManager.render(updateShadowMap, scene === sceneManager.overlay.scene)
    }
    return () => {
      if (object) {
        dispose(object)
        scene.remove(object)
        sceneManager.render(updateShadowMap, scene === sceneManager.overlay.scene)
      }
    }
  }, [object, scene, updateShadowMap])
  useLayoutEffect(() => {
    if (object) {
      object.visible = visible
      sceneManager.render(updateShadowMap, scene === sceneManager.overlay.scene)
    }
  }, [object, scene, updateShadowMap, visible])
  return null
}
