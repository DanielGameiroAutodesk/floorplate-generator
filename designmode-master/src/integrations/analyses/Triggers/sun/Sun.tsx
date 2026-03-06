import { useState } from "preact/hooks"
import { useRecoilValue } from "recoil"
import { elementState } from "src/core/elements/ElementState"
import { areaSelectionOpenState } from "src/integrations/analyses/Selection/analysis-selection-state"
import { useSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import { useAnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { analysisTriggerDisabledSignal } from "src/integrations/analyses/AnalysisSupport/analysisSupport"
import { AnalysisHeader } from "src/integrations/analyses/AnalysisMenu/AnalysisHeader"
import { Selection } from "src/integrations/analyses/Selection/Selection"
import { Divider } from "src/integrations/analyses/Divider"
import { CatalogPreviewComponent } from "src/integrations/analyses/Triggers/CatalogPreviewComponent"
import { SunAnalysisTrigger } from "./components/SunAnalysisTrigger"
import { getAnalysisSupportLevelColors } from "src/integrations/analyses/Triggers/analysisSupportLevels"
import {
  triggerDisabledTooltipText,
  AnalysisTriggerSupportLevelTooltip,
  trackTriggerDisabledHoverOnce,
} from "src/integrations/analyses/Triggers/trigger-utils"
import menuStyles from "src/integrations/analyses/Triggers/Triggers.module.pcss"
import analyseHeaderStyles from "src/integrations/analyses/AnalysisMenu/AnalysisMenu.module.pcss"
import { useTranslator } from "src/i18n"
import { scenarioChildNodesSignal } from "src/integrations/Scenarios/scenarioElementUploadState"

export function Sun() {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value
  const areaSelectionOpen = useRecoilValue(areaSelectionOpenState)
  const { colorElementPaths } = useSelectedElementPaths()
  const { setBuildingColors, clearBuildingColors } = useAnalysisBuildingColorApi()
  const triggerDisabledReason = analysisTriggerDisabledSignal.value
  const tooltipText = triggerDisabledReason && triggerDisabledTooltipText[triggerDisabledReason.code](t)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const scenarioChildNodes = scenarioChildNodesSignal.value

  return (
    <>
      <AnalysisHeader analysisType="sun" />
      <div className={analyseHeaderStyles.AnalyzeHeader}>
        {t(($) => $.analysis.areaTitle)}
        <Selection analysisType="sun" />
      </div>
      <Divider gapLeft gapRight gapBottomSmall />
      <div className={`${menuStyles.Panel}`}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <SunAnalysisTrigger
            disabled={!!triggerDisabledReason}
            tooltip={tooltipText}
            onTriggerButtonMouseOver={() => {
              if (triggerDisabledReason) {
                trackTriggerDisabledHoverOnce("sun", triggerDisabledReason)
                return
              }
              setTooltipVisible(true)
              const buildingColors = getAnalysisSupportLevelColors(
                "sun",
                colorElementPaths,
                snapshot,
                scenarioChildNodes,
              )
              setBuildingColors(buildingColors)
            }}
            onTriggerButtonMouseLeave={() => {
              if (areaSelectionOpen) return
              setTooltipVisible(false)
              clearBuildingColors()
            }}
          />
          <AnalysisTriggerSupportLevelTooltip
            helpUrl="https://help.autodeskforma.com/en/articles/6951253#h_99e4549cc1"
            visible={tooltipVisible}
          />
        </div>
      </div>
      <CatalogPreviewComponent />
    </>
  )
}
