import styles from "./Label.module.pcss"
import { Matrix4, Vector3 } from "three"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import type { InternalPath } from "src/lib/element/path"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks"
import LabelContent from "./LabelContent"
import combineClasses from "src/lib/combineClasses"
import type { AnnotationLabelProperties } from "src/integrations/labels/constants"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { throttleOnePerFrame, useIdleDebounce } from "src/lib/debounce"
import { DesignModeEvents } from "src/core/events/events"
import {
  hoveredIdsSignal,
  resetHoveredIdsSignal,
  scenarioModeSignal,
  selectedPathsInCurrentProposalSignal,
  selectionArraySignal,
  setHoveredIdsSignalValue,
  setSelectionSetSignalValue,
} from "src/core/selection/selectionState"
import { setContextMenuPositionSignalValue } from "src/core/context-menu-state"
import { toolAPI } from "src/core/toolsState"
import sceneManager from "src/core/three/sceneManager"

function onWheel(e: WheelEvent) {
  document
    .getElementById("design-mode-canvas")
    ?.dispatchEvent(new WheelEvent("wheel", { deltaY: e.deltaY, clientX: e.clientX, clientY: e.clientY }))
}

export default function LabelWrapper({
  path,
  worldTransform,
  previewPosition,
  isInBase,
  styleOverrides,
  scale,
  onComplete,
  onCancel,
}: {
  path: InternalPath
  worldTransform?: Matrix4
  previewPosition?: Vec3
  isInBase?: boolean
  styleOverrides?: Partial<AnnotationLabelProperties>
  scale?: number
  onComplete?: (text: string, labelOffset: { x: number; y: number }) => void
  onCancel?: () => void
}) {
  const currentToolId = toolAPI.currentToolSignal.value.id

  const initPos = useMemo(
    () =>
      previewPosition
        ? new Vector3(previewPosition.x, previewPosition.y, previewPosition.z)
        : new Vector3().applyMatrix4(worldTransform || new Matrix4()),
    [previewPosition, worldTransform],
  )

  const selected = onComplete !== undefined || selectedPathsInCurrentProposalSignal.value.has(path)
  const highlighted = onComplete !== undefined || hoveredIdsSignal.value.has(path)

  const ref = useRef<HTMLDivElement>(null)

  const updateScreenPosition = useCallback(() => {
    if (!ref.current) return
    const screenPos = cameraApi.worldToScreen(initPos)

    const { position, direction } = cameraApi.getCurrentCameraState()
    const cameraPosition = new Vector3(position.x, position.y, position.z)

    const camToLabelDirection = initPos.clone().sub(cameraPosition).normalize()
    const isInFrontOfCam = new Vector3(direction.x, direction.y, direction.z).dot(camToLabelDirection) > 0

    ref.current.style.display = isInFrontOfCam ? "block" : "hidden"
    if (!isInFrontOfCam) return

    const canvas = document.getElementById("design-mode-canvas")
    const canvasWidth = canvas?.clientWidth || window.innerWidth
    const canvasHeight = canvas?.clientHeight || window.innerHeight

    const xvw = (screenPos.x / canvasWidth) * 100
    const yvh = (1 - screenPos.y / canvasHeight) * 100

    ref.current.style.transform = `translate3d(${xvw}vw, ${yvh}vh, 0)`

    if (!worldTransform) return
    const transformed = new Vector3().applyMatrix4(worldTransform)
    const distanceToCamera = transformed.distanceTo(cameraPosition)

    // use some arbitrary high number (10km from camera) as max zIndex
    // labels are in their own stacking context defined by their wrapper in HUD.tsx
    ref.current.style.zIndex = `${Math.round(9999 - distanceToCamera)}`
  }, [initPos, worldTransform])

  useEffect(() => {
    updateScreenPosition()
  }, [updateScreenPosition])

  const toggleHidden = useCallback(() => {
    if (!ref.current) return
    const clippingPlanes = sceneManager.sectionBoxClipping.clippingPlanes
    const isHidden = clippingPlanes.some((plane) => plane.distanceToPoint(initPos) < 0)
    if (isHidden) {
      ref.current.classList.add(styles.Hidden)
      return
    }
    ref.current.classList.remove(styles.Hidden)
  }, [initPos])

  const debounceToggleHidden = useIdleDebounce(toggleHidden)

  const toggleOccluded = useCallback(() => {
    if (!ref.current) return
    const screenPos = cameraApi.worldToScreen(initPos)
    const { x, y, z } = cameraApi.getCurrentCameraState().position
    const cameraPosition = new Vector3(x, y, z)

    if (!worldTransform) return
    const location = new Vector3().applyMatrix4(worldTransform)
    const distanceToCamera = location.distanceTo(cameraPosition)
    // Check if the label is occluded by other objects
    const raycastResult = raycastApi.raycast({ x: screenPos.x, y: screenPos.y })
    if (!raycastResult) {
      // no raycast result we're not occluded
      ref.current.classList.remove(styles.Occluded)
      return
    }

    const raycastDistance = cameraPosition.distanceTo(
      new Vector3(raycastResult.position.x, raycastResult.position.y, raycastResult.position.z),
    )
    const errorMargin = cameraApi.pixelsToMetersAtPosition(20, {
      x: location.x,
      y: location.y,
      z: location.z,
    })
    ref.current.classList.toggle(styles.Occluded, raycastDistance < distanceToCamera - errorMargin)
  }, [initPos, worldTransform])

  const debounceToggleOccluded = useIdleDebounce(toggleOccluded)

  // ensure that the label is correctly occluded on mount
  // but only after the first render,
  // for subsequent renders the occlusion is updated by the camera change event and only runs when the browser is idle
  const toggleOccludedRef = useRef(toggleOccluded)
  useLayoutEffect(() => {
    toggleOccludedRef.current()
  }, [])

  useEffect(() => {
    const throttledUpdatePos = throttleOnePerFrame(updateScreenPosition)
    const updatePosNoParams = () => throttledUpdatePos()
    // Add some random delay to avoid all labels updating at the same time

    cameraApi.cameraEvents.addEventListener("change", updatePosNoParams)
    cameraApi.cameraEvents.addEventListener("change", debounceToggleOccluded)
    cameraApi.cameraEvents.addEventListener("change", debounceToggleHidden)
    DesignModeEvents.addListener("model.changed", debounceToggleOccluded)
    DesignModeEvents.addListener("clipping.changed", debounceToggleHidden)
    window.addEventListener("resize", updatePosNoParams)
    return () => {
      cameraApi.cameraEvents.removeEventListener("change", updatePosNoParams)
      cameraApi.cameraEvents.removeEventListener("change", debounceToggleOccluded)
      cameraApi.cameraEvents.removeEventListener("change", debounceToggleHidden)
      DesignModeEvents.removeListener("model.changed", debounceToggleOccluded)
      DesignModeEvents.removeListener("clipping.changed", debounceToggleHidden)
      window.removeEventListener("resize", updatePosNoParams)
    }
  }, [debounceToggleOccluded, selected, toggleOccluded, updateScreenPosition, debounceToggleHidden])

  const onClickAnnotation = useCallback(
    (e: MouseEvent) => {
      if (!selected) {
        setSelectionSetSignalValue(new Set(e.shiftKey ? [...selectionArraySignal.peek(), path] : [path]))
      }
    },
    [path, selected],
  )

  const onRightClickAnnotation = useCallback(
    (e: MouseEvent) => {
      onClickAnnotation(e)
      setContextMenuPositionSignalValue([e.clientX, e.clientY])
      e.preventDefault()
    },
    [onClickAnnotation],
  )

  const isEditingBase = scenarioModeSignal.value

  const disablePointerEvents = useMemo(() => {
    const inSelectTool = currentToolId === "select"

    const outOfContext = !isInBase && isEditingBase

    return (!inSelectTool || outOfContext) && !selected
  }, [currentToolId, isEditingBase, isInBase, selected])

  return (
    <div
      className={combineClasses([styles.PositioningWrapper], {
        [styles.Hovered]: highlighted,
        [styles.Disabled]: disablePointerEvents,
      })}
      style={{
        cursor: "pointer",
      }}
      ref={ref}
      id={`note-${path}`}
      onClick={(e) => onClickAnnotation(e)}
      onMouseEnter={() => setHoveredIdsSignalValue(new Set([path]))}
      onMouseLeave={() => resetHoveredIdsSignal()}
      onContextMenu={onRightClickAnnotation}
      onKeyDown={(e) => {
        e.key === "Escape" && onCancel && onCancel()
      }}
      onWheel={onWheel}
    >
      <LabelContent
        highlighted={highlighted}
        selected={selected}
        path={path}
        onComplete={onComplete}
        isInBase={isInBase}
        styleOverrides={styleOverrides}
        onCancel={onCancel}
        scale={scale}
      />
    </div>
  )
}
