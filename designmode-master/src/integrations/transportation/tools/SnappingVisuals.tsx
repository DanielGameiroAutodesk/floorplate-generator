import { useEffect } from "preact/hooks"
import type { SnapInfo } from "src/integrations/snapping/snappingEngine"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"

export function SnappingLines({ snapInfo }: { snapInfo: SnapInfo | undefined }) {
  useEffect(() => {
    if (snapInfo) snappingAPIStateful.setSnapInfo(snapInfo)
    else snappingAPIStateful.clearSnapInfo()
  }, [snapInfo])

  useEffect(() => {
    return () => {
      snappingAPIStateful.clearSnapInfo()
    }
  }, [])

  return (
    <>
      {snappingAPIStateful.visualsComponent()}
      {snappingAPIStateful.snappingPicker()}
    </>
  )
}
