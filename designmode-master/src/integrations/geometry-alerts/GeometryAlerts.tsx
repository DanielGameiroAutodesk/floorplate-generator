import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { DismissedMessagesIcon } from "./DismissedMessagesIcon"
import GeometryAlertsExpanded from "./GeometryAlertsExpanded"
import styles from "./GeometryAlerts.module.pcss"
import { GeometryAlertsAPI } from "src/core/geometry-alerts"
import { GeometryAlertsToast } from "./GeometryAlertsToast"
import { isLoadingNewProposalSignal } from "src/core/proposal-refresh"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { in3DSketchSignal } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"

export function GeometryAlerts() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("MessageCenter error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "composition", feature: "template-updates" } })
    window.forma_toasts.push({ content: "Error in message center", status: "warning" })
  })

  if (error) return null
  if (!isAppInitializedSignal.value || isLoadingNewProposalSignal.value) return null
  if (Object.values(GeometryAlertsAPI.messagesSignal.value).length === 0) {
    GeometryAlertsAPI.setVisibility("default")
    return null
  } else if (in3DSketchSignal.value && GeometryAlertsAPI.visibilitySignal.value === "default") {
    GeometryAlertsAPI.setVisibility("open")
  }

  switch (GeometryAlertsAPI.visibilitySignal.value) {
    case "default":
      return <GeometryAlertsToast />
    case "collapsed":
      return <DismissedMessagesIcon onClick={() => GeometryAlertsAPI.setVisibility("open")} />
    case "open":
      return (
        <div className={styles.MessageCenterPlacement}>
          <GeometryAlertsExpanded onClose={() => GeometryAlertsAPI.setVisibility("collapsed")} />
        </div>
      )
  }
}
