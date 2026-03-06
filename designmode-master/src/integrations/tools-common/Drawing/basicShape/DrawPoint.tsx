import { useCallback, useState } from "react"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import type { CompleteCallbackPoint, PointPreviewComponent } from "src/integrations/draw/DrawAPI"
import { useMemo } from "preact/compat"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"

export default function DrawPoint({
  onComplete,
  PreviewComponent,
}: {
  onComplete: CompleteCallbackPoint
  PreviewComponent?: PointPreviewComponent
}) {
  const [point, setPoint] = useState<Vec3 | undefined>(undefined)

  const cancelHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.cancelDrawingPoint),
      keyCode: "Escape",
      callback: onComplete,
      editAccessRequired: false,
    }
  }, [onComplete])

  useHotkey(cancelHotkey)

  const onMouseUp = useCallback(() => {
    if (point) onComplete(point)
    return Propagate.YES
  }, [onComplete, point])

  useEventHandler("mouseup", onMouseUp, Priority.TOOL)

  return (
    <>
      <CalculateMousePosition onChange={setPoint} onTerrain={false} />
      {point && PreviewComponent && <PreviewComponent point={point} />}
    </>
  )
}
