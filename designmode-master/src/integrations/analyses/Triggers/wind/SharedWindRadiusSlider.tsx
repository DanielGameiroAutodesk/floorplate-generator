import { useCallback, useEffect, useState } from "preact/hooks"
import { useGroundTextureAPI } from "src/integrations/ground-texture/GroundTextureAPI"
import { GROUND_TEXTURE_API_ID_RAPID_WIND } from "src/integrations/analyses/Triggers/groundSurrogates/wind/WindSurrogate"
import { useIsImperial } from "src/lib/unitSettings"
import { getLocalisedRadius, getDelocalisedRadius } from "./DetailedWindAnalysisTrigger"
import { useTranslator } from "src/i18n"

type SharedWindRadiusSliderProps = {
  radius: number
  onRadiusChange: (radius: number) => void
}

export function SharedWindRadiusSlider({ radius, onRadiusChange }: SharedWindRadiusSliderProps) {
  const t = useTranslator()
  const isImperial = useIsImperial()
  const groundTextureApi = useGroundTextureAPI(GROUND_TEXTURE_API_ID_RAPID_WIND)

  const [activeRadiusSlider, setActiveRadiusSlider] = useState(false)

  // When slider is active, clear previous rapid wind circle.
  // This allows the user to see the circle they are setting.
  useEffect(() => {
    if (activeRadiusSlider) groundTextureApi.remove("rapid-wind-heatmap")
  }, [activeRadiusSlider, groundTextureApi])

  const updateRadius = useCallback(
    (e: CustomEvent<string>) => {
      const newRadius = getDelocalisedRadius(Number(e.detail), isImperial)
      onRadiusChange(newRadius)
    },
    [isImperial, onRadiusChange],
  )

  const dispatchRadiusUpdated = useCallback(() => {
    window.dispatchEvent(new CustomEvent("forma-selected-wind-circle-detailed-radius-updated"))
    setActiveRadiusSlider(false)
  }, [])

  return (
    <>
      <div style={{ display: "flex", font: "var(--11-medium)", justifyContent: "space-between", lineHeight: "24px" }}>
        <span>{t(($) => $.analysis.areaRadius)}</span>
        <span>{getLocalisedRadius(radius, isImperial) + (isImperial ? " ft" : " m")} </span>
      </div>
      <div style={{ padding: "6px 0" }}>
        <weave-slider
          max={isImperial ? "1140" : "350"}
          min={isImperial ? "500" : "150"}
          label={t(($) => $.analysis.properties.radiusLabel)}
          value={`${getLocalisedRadius(radius, isImperial)}`}
          onChange={updateRadius}
          onInput={(e) => {
            updateRadius(e)
            setActiveRadiusSlider(true)
          }}
          onMouseUp={dispatchRadiusUpdated}
        />
      </div>
    </>
  )
}
