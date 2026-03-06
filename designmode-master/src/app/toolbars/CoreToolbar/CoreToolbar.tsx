import { toolAPI } from "src/core/toolsState"
import { PendingOperationBlockingOverlay } from "src/integrations/PendingOperation/PendingOperationBlockingOverlay"
import TopLevelToolbar from "src/app/toolbars/TopLevelToolbar/TopLevelToolbar"
import { useCallback, useEffect, useState } from "preact/hooks"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

type Timeout = ReturnType<typeof setTimeout>

let lastTrackedTimestamp: number

function useHoverTracking() {
  const [hoverTimeout, setHoverTimeout] = useState<Timeout | null>(null)

  const onMouseEnter = useCallback(() => {
    // Don't track too often, as moving from main toolbar to overflow menu will trigger enter/leave
    // as there's a small gap between the elements
    if (lastTrackedTimestamp && Date.now() - lastTrackedTimestamp < 3000) {
      return
    }
    const timeout = setTimeout(() => {
      Analytics.track(EventName.Hover, { feature_category: FeatureCategory.DesignTool, feature: "toolbar" })
      lastTrackedTimestamp = Date.now()
    }, 1000)
    setHoverTimeout(timeout)
  }, [setHoverTimeout])

  const onMouseLeave = useCallback(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
  }, [hoverTimeout, setHoverTimeout])

  useEffect(() => {
    if (hoverTimeout) {
      return () => {
        clearTimeout(hoverTimeout)
      }
    }
  }, [hoverTimeout])

  return { onMouseEnter, onMouseLeave }
}

export default function CoreToolbar() {
  const { onMouseEnter, onMouseLeave } = useHoverTracking()

  return (
    <PendingOperationBlockingOverlay description={(t) => t(($) => $.tools.pendingToolSwitchBlockedMessage)}>
      <forma-toolbar direction="horizontal" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {toolAPI.currentToolSignal.value.toolbar === "topLevel" ? (
          <TopLevelToolbar />
        ) : (
          <toolAPI.currentToolSignal.value.toolbar />
        )}
      </forma-toolbar>
    </PendingOperationBlockingOverlay>
  )
}
