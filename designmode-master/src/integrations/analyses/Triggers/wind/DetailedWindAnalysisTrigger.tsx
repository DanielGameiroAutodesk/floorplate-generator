import { useCallback, useEffect, useErrorBoundary, useMemo, useState } from "preact/hooks"
import ErrorMessage from "src/integrations/analyses/ErrorMessage"
import { captureException } from "@sentry/browser"
import { useGroundTextureAPI } from "src/integrations/ground-texture/GroundTextureAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { CircleGeometry, Color, Matrix4 } from "three"
import { setGeometryColor } from "src/lib/three/geometryUtils"
import { SELECTED_FOR_ANALYSIS_COLOR } from "src/integrations/analyses/Triggers/constants"
import { GROUND_TEXTURE_API_ID_RAPID_WIND } from "src/integrations/analyses/Triggers/groundSurrogates/wind/WindSurrogate"
import { elementState } from "src/core/elements/ElementState"
import { useIsImperial } from "src/lib/unitSettings"
import { AnalysisTrigger } from "./components/AnalysisTrigger"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { useTranslator } from "src/i18n"

const METER_TO_FEET = 1 / 0.3048

export const DEFAULT_RADIUS = "150"

/**
 * NOTE: The radius of the circle returned by this function is only used by
 * wind-surrogate-wc.
 *
 * For the purposes of triggering detailed wind analysis, the radius is
 * instead read from the radius state variable.
 */
function getSelectedWindCircle(): Circle | null {
  return JSON.parse(sessionStorage.getItem("forma-selected-wind-circle") || "null")
}

export function getLocalisedRadius(radius: number, isImperial: boolean = false): number {
  return isImperial ? Math.round(radius * METER_TO_FEET) : radius
}

export function getDelocalisedRadius(radius: number, isImperial: boolean = false): number {
  return isImperial ? Math.round(radius / METER_TO_FEET) : radius
}

export const useDisplayRadiusCircle = (circle: Circle | null, renderScope: string) => {
  const renderApi = useRenderAPI(renderScope, false, true)

  useEffect(() => {
    if (!circle) return
    const circleId = "circle"
    let geom = new CircleGeometry(circle.radius, Math.ceil((circle.radius / 100) * 32)).toNonIndexed()
    geom.applyMatrix4(new Matrix4().makeTranslation(circle.x, circle.y, 0))
    setGeometryColor(new Color(SELECTED_FOR_ANALYSIS_COLOR), geom, 0.8)

    renderApi.upsert({
      id: circleId,
      mode: "normal",
      spec: "basicVertexColorsTransparent",
      transform: new Matrix4().toArray(),
      geometryData: {
        position: geom.getAttribute("position").array as Float32Array,
        color: geom.getAttribute("color").array as Uint8Array,
      },
    })
  }, [renderApi, circle])
}

type DetailedWindAnalysisTriggerProps = {
  radius?: number
  showSlider?: boolean
}

export function DetailedWindAnalysisTrigger({
  radius: externalRadius,
  showSlider = true,
}: DetailedWindAnalysisTriggerProps = {}) {
  const t = useTranslator()
  const [error] = useErrorBoundary()
  const isImperial = useIsImperial()
  const snapshot = elementState.currentSnapshot.value

  const [activeRadiusSlider, setActiveRadiusSlider] = useState(false)
  const groundTextureApi = useGroundTextureAPI(GROUND_TEXTURE_API_ID_RAPID_WIND)

  const [circle, setCircle] = useState(getSelectedWindCircle())
  const [internalRadius, setInternalRadius] = useState(
    Number(sessionStorage.getItem("forma-selected-wind-circle-detailed-radius") || DEFAULT_RADIUS),
  )

  // Use external radius if provided, otherwise use internal radius
  const radius = externalRadius !== undefined ? externalRadius : internalRadius

  // When slider is active, clear previous rapid wind circle.
  // This allows the user to see the circle they are setting.
  useEffect(() => {
    if (activeRadiusSlider) groundTextureApi.remove("rapid-wind-heatmap")
  }, [activeRadiusSlider, groundTextureApi])

  useEffect(() => {
    const updateCircle = () => {
      setCircle(getSelectedWindCircle())
    }

    //TODO: this event is dispatched by wind-surrogate-wc when setting the circle. We should rewrite this to eliminate the link between these two components.
    window.addEventListener("forma-selected-wind-circle-updated", updateCircle)
    return () => window.removeEventListener("forma-selected-wind-circle-updated", updateCircle)
  }, [])

  const updateRadius = useCallback(
    (e: CustomEvent<string>) => {
      const radius = getDelocalisedRadius(Number(e.detail), isImperial)
      setInternalRadius(radius)
      sessionStorage.setItem("forma-selected-wind-circle-detailed-radius", String(radius))
    },
    [setInternalRadius, isImperial],
  )

  const dispatchRadiusUpdated = useCallback(() => {
    window.dispatchEvent(new CustomEvent("forma-selected-wind-circle-detailed-radius-updated"))
    setActiveRadiusSlider(false)
  }, [])

  const centerWithRadius = useMemo(() => {
    if (circle) return { ...circle, radius }
    return { x: 0, y: 0, radius }
  }, [radius, circle])

  useDisplayRadiusCircle(centerWithRadius, "windRadius")

  if (error) {
    console.error(error)
    captureException(error, { level: "error", tags: { owner: "site-analysis" } })
    return <ErrorMessage message={t(($) => $.analysisTooltips.errors.detailedWindUnavailable)} />
  }

  return (
    <>
      {showSlider && (
        <>
          <div
            style={{ display: "flex", font: "var(--11-medium)", justifyContent: "space-between", lineHeight: "24px" }}
          >
            <span>{t(($) => $.analysis.windAreaRadius)}</span>
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
      )}
      <AnalysisTrigger
        rootElementUrn={snapshot.rootUrn}
        disabled={!snapshot.isPersisted}
        tooltip={!snapshot.isPersisted ? t(($) => $.tooltips.analyses.savingInProgress) : undefined}
        x={circle?.x}
        y={circle?.y}
        radius={radius}
      />
    </>
  )
}
