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
import { SkyComponentAnalysisTrigger } from "./components/SkyComponentAnalysisTrigger"
import { getAnalysisSupportLevelColors } from "src/integrations/analyses/Triggers/analysisSupportLevels"
import {
  triggerDisabledTooltipText,
  AnalysisTriggerSupportLevelTooltip,
  trackTriggerDisabledHoverOnce,
} from "src/integrations/analyses/Triggers/trigger-utils"
import menuStyles from "src/integrations/analyses/Triggers/Triggers.module.pcss"
import analyseHeaderStyles from "src/integrations/analyses/AnalysisMenu/AnalysisMenu.module.pcss"
import { useTranslator } from "src/i18n"

export function SkyComponent() {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value
  const { colorElementPaths } = useSelectedElementPaths()
  const areaSelectionOpen = useRecoilValue(areaSelectionOpenState)
  const { setBuildingColors, clearBuildingColors } = useAnalysisBuildingColorApi()
  const triggerDisabledReason = analysisTriggerDisabledSignal.value
  const tooltipText = triggerDisabledReason && triggerDisabledTooltipText[triggerDisabledReason.code](t)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  return (
    <>
      <AnalysisHeader analysisType="sky-component" />
      <div className={analyseHeaderStyles.AnalyzeHeader}>
        {t(($) => $.analysis.areaTitle)}
        <Selection analysisType="sky-component" />
      </div>
      <Divider gapLeft gapRight gapBottomSmall />
      <div className={`${menuStyles.Panel}`}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <SkyComponentAnalysisTrigger
            disabled={!!triggerDisabledReason}
            tooltip={tooltipText}
            onTriggerButtonMouseOver={() => {
              if (triggerDisabledReason) {
                trackTriggerDisabledHoverOnce("sky-component", triggerDisabledReason)
                return
              }
              setTooltipVisible(true)
              const buildingColors = getAnalysisSupportLevelColors("sky-component", colorElementPaths, snapshot)
              setBuildingColors(buildingColors)
            }}
            onTriggerButtonMouseLeave={() => {
              if (areaSelectionOpen) return
              setTooltipVisible(false)
              clearBuildingColors()
            }}
          />
          <AnalysisTriggerSupportLevelTooltip
            helpUrl="https://help.autodeskforma.com/en/articles/6951302#h_dd0cd4db17"
            visible={tooltipVisible}
          />
        </div>
      </div>
      <CatalogPreviewComponent />
    </>
  )
}
