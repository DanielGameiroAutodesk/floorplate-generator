import { useCallback } from "preact/hooks"
import { useIsImperial } from "src/lib/unitSettings"
import {
  getDelocalisedRadius,
  getLocalisedRadius,
} from "src/integrations/analyses/Triggers/wind/DetailedWindAnalysisTrigger"
import { useTranslator } from "src/i18n"

type SharedNoiseRadiusSliderProps = {
  radius: number
  onRadiusChange: (newRadius: number) => void
}

export const SharedNoiseRadiusSlider = ({ radius, onRadiusChange }: SharedNoiseRadiusSliderProps) => {
  const isImperial = useIsImperial()
  const t = useTranslator()

  const updateRadius = useCallback(
    (e: CustomEvent<string>) => {
      const newRadius = getDelocalisedRadius(Number(e.detail), isImperial)
      onRadiusChange(newRadius)
    },
    [onRadiusChange, isImperial],
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", font: "var(--11-medium)", justifyContent: "space-between", lineHeight: "24px" }}>
        <span>{t(($) => $.analysis.noiseAreaRadius)}</span>
        <span>{getLocalisedRadius(radius, isImperial) + (isImperial ? " ft" : " m")} </span>
      </div>
      <div style={{ padding: "6px 0" }}>
        <weave-slider
          max={isImperial ? "1000" : "350"}
          min={isImperial ? "350" : "100"}
          label={t(($) => $.analysis.properties.radiusLabel)}
          value={`${getLocalisedRadius(radius, isImperial)}`}
          onChange={updateRadius}
          onInput={updateRadius}
        />
      </div>
    </div>
  )
}
