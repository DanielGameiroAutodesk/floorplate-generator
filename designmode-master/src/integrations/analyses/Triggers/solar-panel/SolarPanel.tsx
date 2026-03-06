import { useRecoilValue } from "recoil"
import { areaSelectionOpenState } from "src/integrations/analyses/Selection/analysis-selection-state"
import { useSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import { useAnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import type { AnalysisBuildingColors } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { analysisTriggerDisabledSignal } from "src/integrations/analyses/AnalysisSupport/analysisSupport"
import { AnalysisHeader } from "src/integrations/analyses/AnalysisMenu/AnalysisHeader"
import { Selection } from "src/integrations/analyses/Selection/Selection"
import { Divider } from "src/integrations/analyses/Divider"
import { CatalogPreviewComponent } from "src/integrations/analyses/Triggers/CatalogPreviewComponent"
import { SolarPanelAnalysisTrigger } from "./components/SolarPanelAnalysisTrigger"
import { SELECTED_FOR_ANALYSIS_COLOR } from "src/integrations/analyses/Triggers/constants"
import type { InternalPath } from "src/lib/element/path"
import {
  triggerDisabledTooltipText,
  trackTriggerDisabledHoverOnce,
} from "src/integrations/analyses/Triggers/trigger-utils"
import menuStyles from "src/integrations/analyses/Triggers/Triggers.module.pcss"
import analyseHeaderStyles from "src/integrations/analyses/AnalysisMenu/AnalysisMenu.module.pcss"
import { useTranslator } from "src/i18n"

function colorMapAllPaths(paths: InternalPath[], color: string): AnalysisBuildingColors {
  return Object.fromEntries(paths.map((path) => [path, color]))
}

export function SolarPanel() {
  const t = useTranslator()
  const { colorElementPaths } = useSelectedElementPaths()
  const areaSelectionOpen = useRecoilValue(areaSelectionOpenState)
  const { setBuildingColors, clearBuildingColors } = useAnalysisBuildingColorApi()
  const triggerDisabledReason = analysisTriggerDisabledSignal.value
  const tooltipText = triggerDisabledReason && triggerDisabledTooltipText[triggerDisabledReason.code](t)

  return (
    <>
      <AnalysisHeader analysisType="solar-panel" />
      <div className={analyseHeaderStyles.AnalyzeHeader}>
        {t(($) => $.analysis.areaTitle)}
        <Selection analysisType="solar-panel" />
      </div>
      <Divider gapLeft gapRight gapBottomSmall />
      <div className={`${menuStyles.Panel}`}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <SolarPanelAnalysisTrigger
            tooltip={tooltipText}
            disabled={!!triggerDisabledReason}
            onTriggerButtonMouseOver={() => {
              if (triggerDisabledReason) {
                trackTriggerDisabledHoverOnce("solar-panel", triggerDisabledReason)
                return
              }
              setBuildingColors(colorMapAllPaths(colorElementPaths, SELECTED_FOR_ANALYSIS_COLOR))
            }}
            onTriggerButtonMouseLeave={() => {
              if (areaSelectionOpen) return
              clearBuildingColors()
            }}
          />
        </div>
      </div>
      <CatalogPreviewComponent />
    </>
  )
}
