import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { atom, useRecoilState } from "recoil"
import type { Mesh } from "three"
import { defaultCursor, pushPullCursor, pushPullVerticalCursor } from "src/integrations/cursors/setCursor"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import type SurfaceHandle from "./SurfaceHandle"
import { HiddenPaths } from "src/core/hidden"
import sceneManager from "src/core/three/sceneManager"

const pushPullHandles = new Set<SurfaceHandle>()

type PushPullState = {
  path: string
  surface: number | "roof"
}

export const pushPullAtom = atom<PushPullState | undefined>({
  key: "pushPullState",
  default: undefined,
})

export function usePushPullSurfaces(handles: SurfaceHandle[]) {
  useEffect(() => {
    handles.forEach((handle) => pushPullHandles.add(handle))
    return () => handles.forEach((handle) => pushPullHandles.delete(handle))
  }, [handles])
}

export default function PushPull() {
  const [pushPullState, setPushPullState] = useRecoilState(pushPullAtom)
  const isToolActive = !!pushPullState
  const [hoveredSurface, setHoveredSurface] = useState<Mesh | undefined>(undefined)
  const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
  useObjectLifecycle(hoveredSurface)

  useEffect(() => {
    if (pushPullState) {
      pushPullCursor()
    } else {
      defaultCursor()
    }
  }, [pushPullState])

  const getHoveredHandle = useCallback(() => {
    let closest: SurfaceHandle | undefined = undefined
    let minDistance = Infinity
    for (let handle of pushPullHandles) {
      handle.unhover()
      if (sceneManager.is2D && handle.surface === "roof") continue
      const handleDistance = handle.intersect() || Infinity
      if (handleDistance < minDistance && !hiddenPaths.has(handle.elementPath)) {
        closest = handle
        minDistance = handleDistance
      }
    }
    if (closest) closest.hover()
    return closest
  }, [hiddenPaths])

  const hoveringHandle = useRef(false)
  const onMouseMove = useCallback(() => {
    if (isToolActive) {
      return Propagate.NO
    }
    const closestHandle = getHoveredHandle()
    if (closestHandle && closestHandle.isCursorNearInteractionPoint) {
      if (closestHandle.surface === "roof") {
        pushPullVerticalCursor()
      } else {
        pushPullCursor()
      }
      hoveringHandle.current = true
    } else if (hoveringHandle.current) {
      defaultCursor()
      hoveringHandle.current = false
    }
    return Propagate.YES
  }, [getHoveredHandle, isToolActive])

  useEventHandler("mousemove", onMouseMove, Priority.PUSH_PULL, sceneManager.renderer.domElement)

  const onMouseDown = useCallback(() => {
    if (isToolActive) {
      return Propagate.YES
    }
    const closestHandle = getHoveredHandle()
    if (!closestHandle || !closestHandle.isCursorNearInteractionPoint) {
      return Propagate.YES
    }
    for (let handle of pushPullHandles) {
      handle.unhover()
    }
    setPushPullState({
      surface: closestHandle.surface,
      path: closestHandle.elementPath,
    })
    setHoveredSurface(undefined)
    return Propagate.NO
  }, [getHoveredHandle, isToolActive, setPushPullState])

  useEventHandler("mousedown", onMouseDown, Priority.PUSH_PULL, sceneManager.renderer.domElement)

  const onMouseUp = useCallback(() => {
    for (let handle of pushPullHandles) {
      if (handle.isVisible && handle.isCursorNearInteractionPoint && !hiddenPaths.has(handle.elementPath))
        return Propagate.NO
      handle.unhover()
    }
    return Propagate.YES
  }, [hiddenPaths])

  useEventHandler("mouseup", onMouseUp, Priority.PUSH_PULL, sceneManager.renderer.domElement)

  return null
}
