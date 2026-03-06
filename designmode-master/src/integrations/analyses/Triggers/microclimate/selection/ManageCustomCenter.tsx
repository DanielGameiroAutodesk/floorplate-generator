import { signal } from "@preact/signals"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import type { GroundTextureAPIInterface } from "src/integrations/ground-texture/GroundTextureAPI"
import {
  DEFAULT_CIRCLE_RADIUS,
  DEFAULT_CIRCLE_X,
  DEFAULT_CIRCLE_Y,
} from "src/integrations/analyses/Triggers/microclimate/utils/circle"
import useMousePosition from "./useMousePosition"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"

export interface Point {
  x: number
  y: number
}

const MESH_NAME = "microclimate-analysis-circle"

const INITIAL_CENTER = JSON.parse(
  sessionStorage.getItem("forma-selected-microclimate-circle") || `{"x":${DEFAULT_CIRCLE_X},"y":${DEFAULT_CIRCLE_Y}}`,
) as Point

export const customCenterActiveSignal = signal<boolean>(false)
export const customCenterPointSignal = signal<Point>(INITIAL_CENTER)

const useCustomCenterCanvas = ({ radius, customCenterActive }: { radius: number; customCenterActive: boolean }) => {
  return useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = radius * 2
    canvas.height = radius * 2
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "rgba(255, 255, 255, 0)"
    ctx.fillRect(0, 0, radius * 2, radius * 2)
    ctx.beginPath()
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI)
    ctx.fillStyle = customCenterActive ? "rgba(56, 171, 223, 0.9)" : "rgba(56, 171, 223, 0.7)"
    ctx.fill()
    return canvas
  }, [customCenterActive, radius])
}

const ManageCustomCenter = ({
  getTerrainPointUnderMouse,
  groundTextureApi,
  selectedCircle,
}: {
  getTerrainPointUnderMouse: () => Point | undefined
  groundTextureApi: GroundTextureAPIInterface
  selectedCircle: Circle | undefined
}) => {
  const activeRadius = selectedCircle?.radius ?? DEFAULT_CIRCLE_RADIUS
  const customCenterActive = customCenterActiveSignal.value
  const [hoveredPosition, setHoveredPosition] = useState<Point>(INITIAL_CENTER)
  const customCenterCanvas = useCustomCenterCanvas({ radius: activeRadius, customCenterActive })

  const handleSetSelectedCenter = useCallback(() => {
    const center = { x: hoveredPosition.x, y: hoveredPosition.y }
    customCenterPointSignal.value = center
    sessionStorage.setItem("forma-selected-microclimate-circle", JSON.stringify({ ...center, radius: activeRadius }))
    customCenterActiveSignal.value = false
  }, [hoveredPosition, activeRadius])

  // disable selection mode on key press
  useEffect(() => {
    if (customCenterActive) {
      const handleEscapePress = (e: KeyboardEvent) => {
        if (e.code === "Escape") {
          customCenterActiveSignal.value = false
        }
      }
      document.addEventListener("keyup", handleEscapePress)
      return () => document.removeEventListener("keyup", handleEscapePress)
    }
  }, [customCenterActive])

  useEffect(() => {
    if (customCenterActive) {
      window.addEventListener("click", handleSetSelectedCenter)
      return () => {
        window.removeEventListener("click", handleSetSelectedCenter)
      }
    }
  }, [customCenterActive, handleSetSelectedCenter])

  useMousePosition(setHoveredPosition, getTerrainPointUnderMouse, customCenterActive)

  useEffect(() => {
    if (customCenterCanvas) {
      const position = { ...hoveredPosition, z: 50 }
      groundTextureApi.add(MESH_NAME, customCenterCanvas, position)
      return () => {
        groundTextureApi.remove(MESH_NAME)
      }
    }
  }, [groundTextureApi, customCenterCanvas]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const position = { ...hoveredPosition, z: 50 }
    groundTextureApi.updatePosition(MESH_NAME, position)
  }, [hoveredPosition, groundTextureApi])

  useEffect(() => {
    if (!selectedCircle) return
    if (customCenterActive) return
    const position = { x: selectedCircle.x, y: selectedCircle.y, z: 50 }
    groundTextureApi.updatePosition(MESH_NAME, position)
  }, [selectedCircle, groundTextureApi, customCenterActive])

  return null
}

export default ManageCustomCenter
