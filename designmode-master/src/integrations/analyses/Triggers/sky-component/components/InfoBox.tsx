import { signal } from "@preact/signals"
import { useCallback, useEffect } from "preact/hooks"
import { useTranslator } from "src/i18n"

// Import the image - this will be bundled by Vite
import infoboxImageUrl from "src/integrations/analyses/Triggers/sky-component/assets/infobox.png"

const INFOBOX_DISMISSED_KEY = "sky-component-analysis-trigger-infobox-dismissed"

const infoBoxDismissedSignal = signal(JSON.parse(localStorage.getItem(INFOBOX_DISMISSED_KEY) || "false"))

const INFO_ARTICLE_URL =
  "https://help.autodeskforma.com/en/articles/6951302-introduction-to-daylight-potential-analysis"

export function InfoBox() {
  const t = useTranslator()
  const dismissed = infoBoxDismissedSignal.value

  useEffect(() => {
    if (dismissed) {
      localStorage.setItem(INFOBOX_DISMISSED_KEY, JSON.stringify(dismissed))
    }
  }, [dismissed])

  const onDismissClick = useCallback(() => {
    infoBoxDismissedSignal.value = true
  }, [])

  if (dismissed) return null

  return (
    <div
      style={{
        border: "1px solid rgba(60, 60, 60, 0.1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      <img src={infoboxImageUrl} width={208} height={80} alt={t(($) => $.analysis.daylightAnalysisIllustrationAlt)} />
      <span
        style={{
          fontStyle: "normal",
          fontWeight: "400",
          fontSize: "11px",
          lineHeight: "14px",
        }}
      >
        {t.icu(($) => $.analysis.skyComponent.potentialDescription, {
          strong: (chunk) => <strong>{chunk}</strong>,
        })}
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "10px",
          alignSelf: "flex-end",
        }}
      >
        <weave-button onClick={onDismissClick} variant="flat">
          Dismiss
        </weave-button>
        <a href={INFO_ARTICLE_URL} target="_blank" rel="noreferrer">
          <weave-button variant="outlined">{t(($) => $.analysis.learnMore)}</weave-button>
        </a>
      </div>
    </div>
  )
}
