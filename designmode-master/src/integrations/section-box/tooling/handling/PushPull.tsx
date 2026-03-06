import { useCallback, useEffect, useRef } from "preact/hooks"
import { defaultCursor, pushPullCursor, pushPullVerticalCursor } from "src/integrations/cursors/setCursor"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"
import type SurfaceHandle from "src/integrations/tools-common/PushPull/SurfaceHandle"
import { sectionBoxUpdateState, setSectionBoxUpdateState } from "src/integrations/section-box/state"

const allHandles = new Set<SurfaceHandle>()

export function useAddHandles(handles: SurfaceHandle[]) {
  useEffect(() => {
    handles.forEach((handle) => allHandles.add(handle))
    return () => handles.forEach((handle) => allHandles.delete(handle))
  }, [handles])
}

export default function PushPullSectionBox() {
  const sectionBoxUpdate = sectionBoxUpdateState.value
  const isToolActive = !!sectionBoxUpdate

  useEffect(() => {
    if (sectionBoxUpdate) {
      pushPullCursor()
    } else {
      defaultCursor()
    }
  }, [sectionBoxUpdate])

  const getHoveredHandle = useCallback(() => {
    let closest: SurfaceHandle | undefined = undefined
    let minDistance = Infinity
    for (let handle of allHandles) {
      handle.unhover()
      if (sceneManager.is2D && handle.surface === "roof") continue
      const handleDistance = handle.intersect() || Infinity
      if (handleDistance < minDistance) {
        closest = handle
        minDistance = handleDistance
      }
    }
    if (closest) closest.hover()
    return closest
  }, [])

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

  useEventHandler("mousemove", onMouseMove, Priority.SECTION_PUSH_PULL, sceneManager.renderer.domElement)

  const onMouseDown = useCallback(() => {
    if (isToolActive) {
      return Propagate.YES
    }
    const closestHandle = getHoveredHandle()
    if (!closestHandle || !closestHandle.isCursorNearInteractionPoint) {
      return Propagate.YES
    }
    for (let handle of allHandles) {
      handle.unhover()
    }
    setSectionBoxUpdateState({
      surface: closestHandle.surface,
      path: closestHandle.elementPath,
    })
    return Propagate.NO
  }, [getHoveredHandle, isToolActive])

  useEventHandler("mousedown", onMouseDown, Priority.SECTION_PUSH_PULL, sceneManager.renderer.domElement)

  const onMouseUp = useCallback(() => {
    for (let handle of allHandles) {
      if (handle.isVisible && handle.isCursorNearInteractionPoint) return Propagate.NO
      handle.unhover()
    }
    return Propagate.YES
  }, [])

  useEventHandler("mouseup", onMouseUp, Priority.SECTION_PUSH_PULL, sceneManager.renderer.domElement)

  return null
}
