import styles from "./GeometryAlerts.module.pcss"
import type { GeometryAlertsMessage } from "src/core/geometry-alerts"
import { GeometryAlertsAPI } from "src/core/geometry-alerts"
import { useSignal } from "@preact/signals"
import { isDefined } from "src/lib/array"
import { useTranslator } from "src/i18n"

const statusToCssClass = {
  primary: styles.Primary,
  warning: styles.Warning,
  error: styles.Error,
  success: styles.Success,
  none: styles.None,
} satisfies Record<NonNullable<GeometryAlertsMessage["style"]>, string>

export default function GeometryAlertsExpanded({ onClose }: { onClose: () => void }) {
  const t = useTranslator()
  const currentHoverCallbackSignal = useSignal<(() => void) | undefined>(undefined)
  const currentActionHoverCallbackSignal = useSignal<(() => void) | undefined>(undefined)

  return (
    <div className={styles.Expanded}>
      <div className={styles.ExpandedHeader}>
        <p>{t(($) => $.geometryAlerts.header)}</p>
        <weave-icon-button onClick={onClose}>
          <weave-close slot="icon"></weave-close>
        </weave-icon-button>
      </div>

      {Object.values(GeometryAlertsAPI.messagesSignal.value).map((message) => {
        const statusClass = message.style ? statusToCssClass[message.style] : undefined

        return (
          <div
            key={message.id}
            className={styles.ExpandedRow}
            onMouseEnter={() => {
              if (message.onHover) {
                const cleanup = message.onHover()
                if (cleanup) currentHoverCallbackSignal.value = cleanup
              }
            }}
            onMouseLeave={() => {
              if (currentHoverCallbackSignal.value) {
                currentHoverCallbackSignal.value()
                currentHoverCallbackSignal.value = undefined
              }
            }}
            onClick={() => {
              message.onClick?.()
            }}
          >
            <div className={[styles.StatusBar, statusClass ?? ""].join(" ")} />
            <div className={styles.Icon}>{message.icon}</div>
            <div className={styles.Content}>
              <p className={styles.Title}>
                {t.getText(message.title)}
                <span>{isDefined(message.count) ? ` (${message.count})` : ""}</span>
              </p>
              {message.subTitle && <p className={styles.SubTitle}>{message.subTitle(t)}</p>}
            </div>
            <div className={styles.Actions}>
              {message.actions?.map((a, i) => {
                return (
                  <weave-button
                    key={i}
                    variant={a.variant}
                    onClick={a.onClick}
                    onMouseEnter={() => {
                      if (a.onHover) {
                        const cleanup = a.onHover()
                        if (cleanup) currentActionHoverCallbackSignal.value = cleanup
                      }
                    }}
                    onMouseLeave={() => {
                      if (currentActionHoverCallbackSignal.value) {
                        currentActionHoverCallbackSignal.value()
                        currentActionHoverCallbackSignal.value = undefined
                      }
                    }}
                  >
                    {t.getText(a.name)}
                  </weave-button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
