import { useCallback, useEffect, useState } from "preact/hooks"
import ErrorMessage from "src/integrations/analyses/ErrorMessage"
import { WIND_WC_PATH, WindSurrogate } from "src/integrations/analyses/Triggers/groundSurrogates/wind/WindSurrogate"
import { getTranslator, useTranslator } from "src/i18n"
import { useLazyLoadCustomElementScriptWithError } from "src/lib/useLazyLoadScript"
import { DEFAULT_RADIUS, DetailedWindAnalysisTrigger } from "./DetailedWindAnalysisTrigger"
import { CatalogPreviewComponent } from "src/integrations/analyses/Triggers/CatalogPreviewComponent"
import { Divider } from "src/integrations/analyses/Divider"
import { Alerts } from "src/integrations/analyses/Triggers/Alerts"
import { request } from "src/lib/request"
import { PROJECT_ID, projectSignal } from "src/core/project/project"
import { useSignal, useSignalEffect } from "@preact/signals"
import { SharedWindRadiusSlider } from "./SharedWindRadiusSlider"
import { AnalysisHeader } from "src/integrations/analyses/AnalysisMenu/AnalysisHeader"
import { Selection } from "src/integrations/analyses/Selection/Selection"
import DetailedAnalysis from "src/lib/components/icons/DetailedAnalysis"
import RapidAnalysis from "src/lib/components/icons/RapidAnalysis"
import styles from "src/integrations/analyses/Triggers/Wind.module.pcss"
import combineClasses from "src/lib/combineClasses"

export function Wind() {
  const t = useTranslator()
  // Shared radius state for new layout
  const [sharedRadius, setSharedRadius] = useState(
    Number(sessionStorage.getItem("forma-selected-wind-circle-detailed-radius") || DEFAULT_RADIUS),
  )

  const { loading: rapidLoading, failed: rapidFailed } = useLazyLoadCustomElementScriptWithError(
    WIND_WC_PATH,
    "squad-na-east",
    "forma-rapid-wind",
  )

  const toast = useCallback((content: string) => {
    window.forma_toasts.push({
      status: "error",
      content,
      autoDismiss: false,
    })
  }, [])

  useEffect(() => {
    if (rapidLoading) return
    const t = getTranslator()
    if (rapidFailed) {
      toast(t(($) => $.analysisTooltips.errors.rapidWindUnavailableToast))
    }
  }, [rapidFailed, rapidLoading, toast])

  const handleRadiusChange = useCallback((newRadius: number) => {
    setSharedRadius(newRadius)
    sessionStorage.setItem("forma-selected-wind-circle-detailed-radius", String(newRadius))
  }, [])

  if (rapidLoading) {
    return <div>Loading...</div>
  }

  const rapidAnalysisMarkup = rapidFailed ? (
    <ErrorMessage message={t(($) => $.analysisTooltips.errors.rapidWindUnavailableToast)} />
  ) : (
    <WindSurrogate />
  )

  const detailedAnalysisMarkup = <DetailedWindAnalysisTrigger radius={sharedRadius} showSlider={false} />

  return (
    <>
      <AnalysisHeader analysisType="wind" />
      <div className={styles.AnalysisAreaSelection}>
        <div className={styles.AnalysisAreaSelectionHeader}>{t(($) => $.analysis.areaTitle)}</div>
        <Selection analysisType="wind" />
      </div>
      <div className={styles.SharedRadiusSliderContainer}>
        <SharedWindRadiusSlider radius={sharedRadius} onRadiusChange={handleRadiusChange} />
      </div>

      {/* Rapid wind first */}
      <div className={styles.RapidAnalysisContainer}>
        <div className={styles.AnalysisContainerHeader}>
          <RapidAnalysis /> Rapid
        </div>
        <p className={styles.AnalysisText}>
          A real-time prediction of wind conditions based on thousands of simulations.{" "}
          <a
            href="https://help.autodeskforma.com/en/articles/6981020-rapid-and-detailed-wind-analysis-in-next-gen-projects-beta"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.LearnMore}
          >
            Learn more
          </a>
        </p>
        <div className={combineClasses([styles.AnalysisContainerContent, styles.AnalysisContainerMorePadding])}>
          {rapidAnalysisMarkup}
        </div>
        <AlertNoWindData />
      </div>

      {/* Detailed wind second */}
      <div className={styles.DetailedAnalysisContainer}>
        <div className={styles.AnalysisContainerHeader}>
          <DetailedAnalysis /> Detailed
        </div>
        <p className={styles.AnalysisText}>
          An in-depth assessment of wind speed and direction, and pedestrian wind comfort.{" "}
          <a
            href="https://help.autodeskforma.com/en/articles/6981020-rapid-and-detailed-wind-analysis-in-next-gen-projects-beta"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.LearnMore}
          >
            Learn more
          </a>
        </p>
        <div className={styles.AnalysisContainerContent}>{detailedAnalysisMarkup}</div>
        <CatalogPreviewComponent variant="NO-BORDER" showDivider />
      </div>
    </>
  )
}

const NUMBER_OF_SUPPORTED_WIND_DIRECTIONS = 8

export const useWindRoseDataUnavailable = () => {
  const windRoseFetchFailedSignal = useSignal(false)
  useSignalEffect(() => {
    const geoLocation = projectSignal.value?.geoLocation
    if (!geoLocation) return
    const [lat, lon] = geoLocation
    request(
      `/api/wind-analysis/wind-roses?longitude=${lon}&latitude=${lat}&number_of_directions=${NUMBER_OF_SUPPORTED_WIND_DIRECTIONS}&authcontext=${PROJECT_ID}`,
    ).catch(() => {
      windRoseFetchFailedSignal.value = true
    })
  })
  return windRoseFetchFailedSignal.value
}

function AlertNoWindData() {
  const windRoseUnavailable = useWindRoseDataUnavailable()
  const t = useTranslator()

  if (!windRoseUnavailable) return null
  const title = t(($) => $.analysis.windRoseUnavailable.title)
  const description = t(($) => $.analysis.windRoseUnavailable.windDescription)

  return (
    <>
      <div style={{ padding: "0 32px" }}>
        <Divider />
      </div>
      <Alerts alerts={[{ id: "missing-wind-rose", title, description }]} newDesign={true} />
    </>
  )
}
