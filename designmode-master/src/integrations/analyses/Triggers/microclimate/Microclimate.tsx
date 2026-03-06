import { AnalysisHeader } from "src/integrations/analyses/AnalysisMenu/AnalysisHeader"
import { Selection } from "src/integrations/analyses/Selection/Selection"
import { Divider } from "src/integrations/analyses/Divider"
import { CatalogPreviewComponent } from "src/integrations/analyses/Triggers/CatalogPreviewComponent"
import { MicroclimateAnalysisTrigger } from "./components/MicroclimateAnalysisTrigger"
import { analysisTriggerDisabledSignal } from "src/integrations/analyses/AnalysisSupport/analysisSupport"
import { Alerts } from "src/integrations/analyses/Triggers/Alerts"
import { useWindRoseDataUnavailable } from "src/integrations/analyses/Triggers/wind/Wind"
import { triggerDisabledTooltipText } from "src/integrations/analyses/Triggers/trigger-utils"
import analyseHeaderStyles from "src/integrations/analyses/AnalysisMenu/AnalysisMenu.module.pcss"
import { useTranslator } from "src/i18n"

function MicroclimateAlertNoWindData() {
  const t = useTranslator()
  const windRoseUnavailable = useWindRoseDataUnavailable()
  if (!windRoseUnavailable) return null
  const title = t(($) => $.analysis.windRoseUnavailable.title)
  const description = t(($) => $.analysis.windRoseUnavailable.description)
  return <Alerts alerts={[{ id: "missing-wind-rose", title, description }]} />
}

export function Microclimate() {
  const t = useTranslator()
  const triggerDisabledReason = analysisTriggerDisabledSignal.value
  const tooltipText = triggerDisabledReason && triggerDisabledTooltipText[triggerDisabledReason.code](t)

  return (
    <>
      <MicroclimateAlertNoWindData />
      <AnalysisHeader analysisType="microclimate" />
      <div className={analyseHeaderStyles.AnalyzeHeader}>
        {t(($) => $.analysis.areaTitle)}
        <Selection analysisType="microclimate" />
      </div>
      <Divider gapLeft gapRight gapBottomSmall />
      <MicroclimateAnalysisTrigger tooltip={tooltipText} disabled={!!triggerDisabledReason} />
      <CatalogPreviewComponent />
    </>
  )
}
