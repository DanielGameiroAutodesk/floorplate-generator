import styles from "./GeometryAlerts.module.pcss"
import type { GeometryAlertsMessage } from "src/core/geometry-alerts"
import { GeometryAlertsAPI } from "src/core/geometry-alerts"
import { computed } from "@preact/signals"
import { objectKeys } from "src/lib/record"
import { useTranslator } from "src/i18n"

const STYLE_PRIORITY = {
  error: 10,
  warning: 9,
  success: 8,
  primary: 7,
  none: 0,
} satisfies Record<NonNullable<GeometryAlertsMessage["style"]>, number>

export function GeometryAlertsToast() {
  const t = useTranslator()
  const mostSeriousMessageSignal = computed(() =>
    Object.values(GeometryAlertsAPI.messagesSignal.value).reduce<NonNullable<GeometryAlertsMessage["style"]>>(
      (prev, curr) => {
        if (curr.style && STYLE_PRIORITY[curr.style] > STYLE_PRIORITY[prev]) {
          return curr.style
        }
        return prev
      },
      "none",
    ),
  )

  const toastStyle = styles[mostSeriousMessageSignal.value]
  return (
    <div className={styles.MessageCenterPlacement}>
      <div className={`${styles.toast} ${toastStyle}`} onClick={() => GeometryAlertsAPI.setVisibility("open")}>
        <div className={styles.group}>
          <div className={styles.text}>
            <h1>
              {t(($) => $.geometryAlerts.title, { count: objectKeys(GeometryAlertsAPI.messagesSignal.value).length })}
            </h1>
            <a>{t(($) => $.geometryAlerts.review)}</a>
          </div>
        </div>
        <weave-tooltip text={t(($) => $.geometryAlerts.dismiss)} className={styles.closeIcon}>
          <weave-icon-button
            onClick={(e) => {
              e.stopPropagation()
              GeometryAlertsAPI.setVisibility("collapsed")
            }}
          >
            <weave-close slot="icon"></weave-close>
          </weave-icon-button>
        </weave-tooltip>
      </div>
    </div>
  )
}
