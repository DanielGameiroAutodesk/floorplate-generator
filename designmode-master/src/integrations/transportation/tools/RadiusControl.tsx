import { signal, useSignal } from "@preact/signals"
import { Propagate } from "@spacemakerai/web-sketch-renderer"
import { useCallback, useEffect, useRef } from "preact/hooks"
import { raycast } from "src/core/terrain/2d-raytracer"
import sceneManager from "src/core/three/sceneManager"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { throttleOnePerFrame } from "src/lib/debounce"
import { Priority, useEventHandler } from "src/lib/eventManager"
import type { Matrix4 } from "three"
import { Vector2, Vector3 } from "three"
import styles from "./RadiusControl.module.pcss"
import type { RadiusPoint } from "src/integrations/transportation/lib/transportationApi"
import { get2dTransform } from "src/integrations/transportation/utils"
import useGuideText from "./useGuideText"
import { ToolLengthInput } from "src/integrations/inputs/floating/ToolLengthInput"
import { exitCurrentTool } from "src/core/toolsState"
import { useReadonlySignal } from "src/lib/signal"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import transportationApi, { type TransportType } from "src/integrations/transportation/lib/transportationApi"
import { useIsImperial } from "src/lib/unitSettings"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type PointRadiusData = {
  position: Vector3
  screenPosition: { x: number; y: number }
  radius: number
  id: string
  distanceToCamera: number
}

type RadiusControlData = {
  pointsWithRadius: RadiusPoint[]
  setRadiusOnPoint: (radius: number, id: string) => void
  previewRadiusOnPoint: (radius: number, id: string) => void
  globalTransform: Matrix4
  cancel: () => void
  transportationType: TransportType
}

const radiusControlDataSignal = signal<RadiusControlData | undefined>(undefined)
export const setRadiusControlData = (data: RadiusControlData | undefined) => (radiusControlDataSignal.value = data)

export const TransportationRadiusControl = () => {
  if (!radiusControlDataSignal.value) return null

  return <WorldPositionedRadiusInfo {...radiusControlDataSignal.value} />
}

export const activeRadiusIndicatorPointSignal = signal<string | undefined>(undefined)

const arrowsUsedSignal = signal(false)

const WorldPositionedRadiusInfo = ({
  pointsWithRadius,
  setRadiusOnPoint,
  globalTransform,
  cancel,
  previewRadiusOnPoint,
  transportationType,
}: {
  pointsWithRadius: RadiusPoint[]
  setRadiusOnPoint: (radius: number, id: string) => void
  previewRadiusOnPoint: (radius: number, id: string) => void
  globalTransform: Matrix4
  cancel: () => void
  transportationType: TransportType
}) => {
  const isActiveRadiusInput = activeRadiusIndicatorPointSignal.value !== undefined
  useGuideText(() => (isActiveRadiusInput ? "Press ↑↓ to increase or decrease radius" : ""), isActiveRadiusInput)

  const terrainSamplerData = terrainSignal.value.terrainSamplerData
  const pointsDataSignal = useSignal<PointRadiusData[] | undefined>(undefined)
  useEffect(() => {
    const xyTransform = get2dTransform(globalTransform)
    const vec2s = pointsWithRadius.map((v) => new Vector2(v.position.x, v.position.y).applyMatrix3(xyTransform))
    const elevations = vec2s.map((v) => raycast(v.x, v.y, terrainSamplerData))
    const positions3D = vec2s.map((v, i) => new Vector3(v.x, v.y, elevations[i]))
    const screenPositions = positions3D.map((v) => cameraApi.worldToScreen(v))
    const cameraPosition = cameraApi.getCurrentCameraState().position
    const distancesToCamera = positions3D.map((v) => v.distanceTo(cameraPosition))
    pointsDataSignal.value = positions3D.map((v, i) => ({
      position: v,
      screenPosition: screenPositions[i],
      radius: pointsWithRadius[i].radius,
      id: pointsWithRadius[i].id,
      distanceToCamera: distancesToCamera[i],
    }))
  }, [pointsWithRadius, terrainSamplerData, pointsDataSignal, globalTransform])

  const onCameraChange = useCallback(() => {
    if (pointsDataSignal.peek()) {
      const cameraPosition = cameraApi.getCurrentCameraState().position
      pointsDataSignal.value = pointsDataSignal.peek()!.map((v) => ({
        ...v,
        screenPosition: cameraApi.worldToScreen(v.position),
        distanceToCamera: v.position.distanceTo(cameraPosition),
      }))
    }
  }, [pointsDataSignal])

  useEffect(() => {
    const onCameraChangeThrottled = throttleOnePerFrame(onCameraChange)
    cameraApi.cameraEvents.addEventListener("change", onCameraChangeThrottled)
    cameraApi.cameraEvents.addEventListener("toggle", onCameraChangeThrottled)
    window.addEventListener("resize", onCameraChangeThrottled)
    return () => {
      cameraApi.cameraEvents.removeEventListener("change", onCameraChangeThrottled)
      cameraApi.cameraEvents.removeEventListener("toggle", onCameraChangeThrottled)
      window.removeEventListener("resize", onCameraChangeThrottled)
    }
  }, [onCameraChange])

  const keydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        activeRadiusIndicatorPointSignal.value = undefined
        exitCurrentTool()
      } else if (event.key === "Escape") {
        cancel()
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        arrowsUsedSignal.value = true
      }
      return Propagate.YES
    },
    [cancel],
  )

  const mousedown = useCallback(() => {
    activeRadiusIndicatorPointSignal.value = undefined
    return Propagate.YES
  }, [])

  useEventHandler("keydown", keydown, Priority.SUBTOOL)
  useEventHandler("mousedown", mousedown, Priority.SUBTOOL, sceneManager.renderer.domElement)

  return (
    <div>
      {pointsDataSignal.value &&
        pointsDataSignal.value.map((v) => (
          <RadiusIndicator
            radius={v.radius}
            position={v.screenPosition}
            pointId={v.id}
            distanceToCamera={v.distanceToCamera}
            setRadiusOnPoint={setRadiusOnPoint}
            previewRadiusOnPoint={previewRadiusOnPoint}
            key={v.id}
            transportationType={transportationType}
          />
        ))}
    </div>
  )
}

const RadiusIndicator = ({
  radius,
  position,
  pointId,
  distanceToCamera,
  setRadiusOnPoint,
  previewRadiusOnPoint,
  transportationType,
}: {
  radius: number
  position: { x: number; y: number }
  pointId: string
  distanceToCamera: number
  setRadiusOnPoint: (radius: number, id: string) => void
  previewRadiusOnPoint: (radius: number, id: string) => void
  transportationType: TransportType
}) => {
  const zIndex = activeRadiusIndicatorPointSignal.value === pointId ? 1 : -Math.round(distanceToCamera)
  const setRadius = useCallback((radius: number) => setRadiusOnPoint(radius, pointId), [setRadiusOnPoint, pointId])
  const previewRadius = useCallback(
    (radius: number) => previewRadiusOnPoint(radius, pointId),
    [previewRadiusOnPoint, pointId],
  )
  return (
    <>
      <ConnectingLine position={position} zIndex={zIndex} />
      <RadiusInputWrapper
        screenPosition={position}
        radius={radius}
        setRadius={setRadius}
        previewRadius={previewRadius}
        pointId={pointId}
        zIndex={zIndex}
        transportationType={transportationType}
      />
    </>
  )
}

const ConnectingLine = ({ position, zIndex }: { position: { x: number; y: number }; zIndex: number }) => {
  return (
    <div
      className={styles.ConnectingLine}
      style={{
        bottom: position.y,
        left: position.x + 4,
        width: "36px",
        zIndex,
      }}
    ></div>
  )
}

type RadiusInputWrapperProps = {
  screenPosition: { x: number; y: number }
  radius: number
  setRadius: (radius: number) => void
  previewRadius: (radius: number) => void
  pointId: string
  zIndex: number
  transportationType: TransportType
}

const RadiusInputWrapper = ({
  screenPosition,
  radius,
  setRadius,
  previewRadius,
  pointId,
  zIndex,
  transportationType,
}: RadiusInputWrapperProps) => {
  const useImperialUnits = useIsImperial()

  const active = activeRadiusIndicatorPointSignal.value === pointId
  useSetRadiusOnBecomingInactive(radius, setRadius, active)

  const onChange = useCallback(
    (value: number | undefined) => {
      if (value === undefined || activeRadiusIndicatorPointSignal.peek() !== pointId) return
      previewRadius(value)

      setTimeout(() => {
        const action = arrowsUsedSignal.peek() ? "radius-arrow" : "radius-input"

        Analytics.trackEditElement(
          EventName.Edit,
          { feature_category: FeatureCategory.DesignTool, feature: "transportation", object_type: "element" },
          {
            category: transportationApi.transportTypeToElementCategory(transportationType),
            transportation_curve_action: action,
          },
        )

        arrowsUsedSignal.value = false
      }, 0)
    },
    [previewRadius, pointId, transportationType],
  )

  const focus = useCallback(() => {
    if (activeRadiusIndicatorPointSignal.peek() !== pointId) {
      activeRadiusIndicatorPointSignal.value = pointId
    }
  }, [pointId])
  const clickHandler = useCallback(
    (e: MouseEvent) => {
      if (activeRadiusIndicatorPointSignal.peek() === pointId) return
      activeRadiusIndicatorPointSignal.value = pointId
      e.stopPropagation()
    },
    [pointId],
  )
  return (
    <div
      className={styles.RadiusInputWrapper}
      style={{
        bottom: screenPosition.y - 16,
        left: screenPosition.x + 40,
        zIndex,
      }}
      onClick={clickHandler}
    >
      <ToolLengthInput
        metricValue={radius}
        metricMin={0}
        metricMax={100000}
        useImperialUnits={useImperialUnits}
        change={onChange}
        active={active}
        icon={radiusIcon}
        focus={focus}
        sharedInputWidthCh={10}
      />
    </div>
  )
}

function useSetRadiusOnBecomingInactive(radius: number, setRadius: (radius: number) => void, active: boolean) {
  const currentRadiusSignal = useReadonlySignal(radius)
  const updateRadiusCallback = useCallback(() => {
    setRadius(currentRadiusSignal.peek())
  }, [currentRadiusSignal, setRadius])

  const updateRadiusRef = useRef<() => void | undefined>()
  updateRadiusRef.current = updateRadiusCallback

  useEffect(() => {
    if (active)
      return () => {
        updateRadiusRef.current?.()
      }
  }, [active])
}

const radiusIcon = <div style={{ transform: "translateY(-4px)", font: "var(--14-bold)" }}>R</div>
