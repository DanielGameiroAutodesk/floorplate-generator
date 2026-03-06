import { useSignal } from "@preact/signals"
import { RADIUS_PRESETS } from "./DrawingProperties"
import styles from "./DefaultRadius.module.pcss"
import { useTranslator, type Translator } from "src/i18n"

const infoTexts = {
  Tight: (t: Translator) => t(($) => $.transportation.cornerRadius.tight),
  Smooth: (t: Translator) => t(($) => $.transportation.cornerRadius.smooth),
}

export const Radius = ({
  radius,
  onChange,
  width,
}: {
  radius: number
  onChange: (newVal: number) => void
  width: number
}) => {
  const t = useTranslator()
  const hoverLabelSignal = useSignal<string | undefined>(undefined)
  const hoverLabel = hoverLabelSignal.value

  return (
    <div className={styles.Wrapper}>
      <weave-segmented-buttons-group value={radius}>
        {RADIUS_PRESETS.map(({ factor, label }, i) => {
          const value = factor * width
          return (
            <weave-segmented-button
              value={value}
              key={i}
              onClick={() => onChange(value)}
              style={{ width: "55px" }}
              onMouseLeave={() => (hoverLabelSignal.value = undefined)}
              onMouseEnter={() => (hoverLabelSignal.value = label)}
            >
              <span style={{ font: "var(--12-medium)" }}>{label}</span>
            </weave-segmented-button>
          )
        })}
      </weave-segmented-buttons-group>
      <div className={styles.TooltipsWrapper}>
        {RADIUS_PRESETS.map(({ label }, i) => {
          // Manually show tooltip element based on hover state, as weave-tooltip doesn't work with weave-segmented-button/weave-segmented-buttons-group
          const right = (110 / RADIUS_PRESETS.length) * (RADIUS_PRESETS.length - i - 1) + 30
          const textFn = infoTexts[label as keyof typeof infoTexts]
          if (!textFn) return null
          const text = textFn(t)
          return (
            <div
              className={`${styles.Tooltip} ${hoverLabel === label ? styles.Active : styles.Inactive}`}
              style={{ right, width: "228px" }}
              key={i}
            >
              {text}
            </div>
          )
        })}
      </div>
    </div>
  )
}
