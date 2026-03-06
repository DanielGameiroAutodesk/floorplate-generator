import { useCallback, useEffect, useState } from "preact/compat"
import { useRecoilState } from "recoil"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { defaultCursor, setCrossHairCursor } from "src/integrations/cursors/setCursor"
import styles from "./ElevationAtCursor.module.pcss"
import { measurementToolsOpenState } from "src/integrations/SceneToolsToolbar/tools/GuidesAndMeasurements/GuidesAndMeasurements"
import FormatLength from "src/lib/components/FormatLength"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { exitCurrentTool } from "src/core/toolsState"
import { useTranslator } from "src/i18n"

export default function ElevationAtCursor() {
  const t = useTranslator()
  const [htmlPosition, setHtmlPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [z, setZ] = useState(0)

  const [measurementToolsOpen, setMeasurementToolsOpen] = useRecoilState(measurementToolsOpenState)

  useEffect(() => {
    setCrossHairCursor()
    return defaultCursor
  }, [])

  const mousemove = useCallback((e: MouseEvent) => {
    setHtmlPosition({ x: e.clientX, y: e.clientY })
    const pos = raycastApi.raycastMousePosition()
    if (pos) {
      setZ(pos.position.z)
    }
    return Propagate.YES
  }, [])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (measurementToolsOpen) {
          setMeasurementToolsOpen(false)
        } else {
          exitCurrentTool()
        }

        return Propagate.NO
      }

      return Propagate.YES
    },
    [measurementToolsOpen, setMeasurementToolsOpen],
  )

  useEventHandler("keydown", keydown, Priority.TOOL)
  useEventHandler("mousemove", mousemove, Priority.TOOL)

  if (!htmlPosition) return null

  return (
    <div
      style={{ transform: `translateX(calc(${htmlPosition.x}px + 15px)) translateY(calc(${htmlPosition.y}px))` }}
      className={styles.ElevationAtCursorWrapper}
    >
      <FormatLength metricLength={z} /> {t(($) => $.units.asl)}
    </div>
  )
}
