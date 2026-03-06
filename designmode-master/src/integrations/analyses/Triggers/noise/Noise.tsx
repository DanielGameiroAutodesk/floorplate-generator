import { RapidNoise } from "src/integrations/analyses/Triggers/groundSurrogates/noise/RapidNoise"
import { NoiseAnalysisTrigger } from "./NoiseAnalysisTrigger"
import { SharedNoiseRadiusSlider } from "./SharedNoiseRadiusSlider"
import { useTranslator } from "src/i18n"
import { CatalogPreviewComponent } from "src/integrations/analyses/Triggers/CatalogPreviewComponent"
import { AnalysisHeader } from "src/integrations/analyses/AnalysisMenu/AnalysisHeader"
import { Selection } from "src/integrations/analyses/Selection/Selection"

import styles from "src/integrations/analyses/Triggers/Wind.module.pcss"
import combineClasses from "src/lib/combineClasses"
import DetailedAnalysis from "src/lib/components/icons/DetailedAnalysis"
import RapidAnalysis from "src/lib/components/icons/RapidAnalysis"
import { useState, useCallback } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { useSignal, useSignalEffect } from "@preact/signals"

import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { hasValidNoiseData, checkElementHierarchy } from "./utils"
import { AnalysisError } from "src/lib/components/icons/AnalysisError"
import { AnalysisArrow } from "src/lib/components/icons/AnalysisArror"

const DEFAULT_RADIUS = "100"
const ROAD_RAIL_INTERCOM_CHECKLIST_ID = 41506830

export function Noise() {
  const t = useTranslator()
  const noElementsWithRequiredInputSignal = useSignal(false)

  useSignalEffect(() => {
    // Access signal inside the effect for proper reactivity
    const currentProposal = elementState.currentProposalSignal.value
    const topLevelNodes = currentProposal.getToplevelNodes()

    if (!topLevelNodes.length) {
      noElementsWithRequiredInputSignal.value = true
      return
    }

    // Check if any top-level node has valid traffic data
    // Access fresh element data from the current snapshot to ensure we get updated traffic data
    const hasValidTrafficData = topLevelNodes.some((node) => {
      // Get fresh element data from the current snapshot
      const freshElement = currentProposal.snapshot.getElementContainer(node.urn)?.element
      if (!freshElement) return false

      // Check top-level transport elements
      if (freshElement.properties?.category === "road" || freshElement.properties?.category === "rails") {
        return hasValidNoiseData(freshElement)
      }

      // For other elements, check using the hierarchy function
      return checkElementHierarchy(freshElement)
    })

    noElementsWithRequiredInputSignal.value = !hasValidTrafficData
  })

  // Shared radius state for new layout
  const [sharedRadius, setSharedRadius] = useState(
    Number(sessionStorage.getItem("forma-selected-noise-circle-detailed-radius") || DEFAULT_RADIUS),
  )

  const handleRadiusChange = useCallback((newRadius: number) => {
    setSharedRadius(newRadius)
    sessionStorage.setItem("forma-selected-noise-circle-detailed-radius", String(newRadius))
  }, [])

  return (
    <>
      <AnalysisHeader analysisType="noise" />
      <div className={styles.AnalysisAreaSelection}>
        <div className={styles.AnalysisAreaSelectionHeader}>{t(($) => $.analysis.areaTitle)}</div>
        <Selection analysisType="noise" />
      </div>
      <div className={styles.SharedRadiusSliderContainer}>
        <SharedNoiseRadiusSlider radius={sharedRadius} onRadiusChange={handleRadiusChange} />
      </div>

      {noElementsWithRequiredInputSignal.value && <MissingTrafficData />}

      {/* Rapid noise first */}
      <div className={styles.RapidAnalysisContainer} style={{ marginTop: "16px" }}>
        <div className={styles.AnalysisContainerHeader}>
          <RapidAnalysis /> Rapid
        </div>
        <p className={styles.AnalysisText}>
          A real-time prediction of noise conditions based on machine learning models.{" "}
          <a
            href="https://help.autodeskforma.com/en/articles/7338314-introduction-to-the-noise-analysis"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.LearnMore}
          >
            Learn more
          </a>
        </p>
        <div className={combineClasses([styles.AnalysisContainerContent, styles.AnalysisContainerMorePadding])}>
          <RapidNoise />
        </div>
      </div>

      {/* Detailed noise second */}
      <div className={styles.DetailedAnalysisContainer}>
        <div className={styles.AnalysisContainerHeader}>
          <DetailedAnalysis /> Detailed
        </div>
        <p className={styles.AnalysisText}>
          An in-depth assessment of noise levels and acoustic conditions.{" "}
          <a
            href="https://help.autodeskforma.com/en/articles/7338314-introduction-to-the-noise-analysis"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.LearnMore}
          >
            Learn more
          </a>
        </p>
        <div className={styles.AnalysisContainerContent}>
          <NoiseAnalysisTrigger radius={sharedRadius} showSlider={false} />
        </div>
        <CatalogPreviewComponent variant="NO-BORDER" showDivider />
      </div>
    </>
  )
}

const openChecklist = () => {
  window.Intercom?.("startChecklist", ROAD_RAIL_INTERCOM_CHECKLIST_ID)
  Analytics.track(
    EventName.Open,
    {
      feature_category: FeatureCategory.Analysis,
      feature: "Checklist",
    },
    { source: "empty_state" },
  )
}

const MissingTrafficData = () => {
  const t = useTranslator()
  return (
    <div className={styles.MissingTrafficData}>
      <div className={styles.MissingTrafficDataHeader}>
        <AnalysisError />
        {t(($) => $.analysis.missingTrafficData.title)}
      </div>
      <div className={styles.MissingTrafficDataContent}>
        <p>{t(($) => $.analysis.missingTrafficData.description)}</p>
        <weave-linkbutton variant="flat" iconposition="right" onClick={openChecklist} target="_self">
          <div className={styles.MissingTrafficDataIcon}>
            <AnalysisArrow />
          </div>
          {t(($) => $.analysis.missingTrafficData.startGuideButton)}
        </weave-linkbutton>
      </div>
    </div>
  )
}
