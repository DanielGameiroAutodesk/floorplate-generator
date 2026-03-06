import { useRecoilValue } from "recoil"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { Wind } from "./wind/Wind"
import { Noise } from "./noise/Noise"
import { KeyFigures } from "src/integrations/analyses/AreaMetrics/KeyFigures"
import { Microclimate } from "./microclimate/Microclimate"
import { SolarPanel } from "./solar-panel/SolarPanel"
import { SkyComponent } from "./sky-component/SkyComponent"
import { Sun } from "./sun/Sun"
import { EmbeddedViewHost } from "src/integrations/extensions/EmbeddedViews/EmbeddedViewHost"
import { EmbeddedViewPlacement, useInstallationsWithExtension } from "src/integrations/extensions/extension-service"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import { activeAnalysisSignal, requestedAnalysisState } from "src/integrations/analyses/analysis-state"
import { useCallback, useEffect, useState } from "preact/hooks"
import { PROJECT_ID } from "src/core/project/project"
import { EmbodiedCarbonAnalysis } from "src/integrations/analyses/EmbodiedCarbonAnalysis/EmbodiedCarbonAnalysis"
import { OperationalCarbonAnalysis } from "src/integrations/analyses/OperationalCarbonAnalysis/OperationalCarbonAnalysis"
import { useIsImperial } from "src/lib/unitSettings"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { checkForPotentialImpactedAnalyses, checkForPotentialIncidents } from "./Incidents"
import { proposalIdSignal } from "src/core/proposal"

export const AnalysesExtensionsComponent = (props: {
  analysis: AnalysisType
  analysisId?: string | undefined
  embeddedViewVisibility?: "visible" | "hidden"
  closeEmbeddedView?: () => void
}) => {
  const installationsWithExtension = useInstallationsWithExtension()

  if (props.analysis == null || !props.analysis.startsWith("analyses-extensions:")) {
    return null
  }

  const [, extensionId, embeddedViewIndex] = props.analysis.split(":")
  const { extension, installation } = installationsWithExtension?.find((it) => it.extension.id === extensionId) ?? {}
  const embeddedView = extension?.resources.embeddedViews?.[Number(embeddedViewIndex)]

  if (
    extension == null ||
    installation == null ||
    embeddedView == null ||
    embeddedView.placement !== EmbeddedViewPlacement.RIGHT_MENU_ANALYSIS_PANEL
  ) {
    return null
  }

  const url = new URL(embeddedView.url)
  if (props.analysisId != null) {
    url.searchParams.set("analysisId", props.analysisId)
  }

  return (
    <EmbeddedViewHost
      src={url.toString()}
      extension={extension}
      installation={installation}
      projectId={PROJECT_ID}
      placement={embeddedView.placement}
      visibility={props.embeddedViewVisibility}
      close={props.closeEmbeddedView}
    />
  )
}

export function Analyses() {
  const [embeddedViewVisibility, setEmbeddedViewVisibility] = useState<"visible" | "hidden">("visible")
  const isImperial = useIsImperial()
  const activeAnalysis = activeAnalysisSignal.value
  const activeAnalysisType = activeAnalysis?.split(":")[0]
  const requestedAnalysis = useRecoilValue(requestedAnalysisState)

  const projectAccess = editAccessLevelSignal.value
  const currentProposalId = proposalIdSignal.value
  useEffect(() => {
    if (projectAccess === "edit") checkForPotentialImpactedAnalyses(currentProposalId)
  }, [projectAccess, currentProposalId])

  useEffect(() => {
    if (projectAccess === "edit") checkForPotentialIncidents()
  }, [projectAccess])

  const loadRequestedAnalysis = useCallback(() => {
    activeAnalysisSignal.value = requestedAnalysis
    setEmbeddedViewVisibility("visible")
  }, [requestedAnalysis])

  useEffect(() => {
    if (activeAnalysisType === "analyses-extensions" && activeAnalysis !== requestedAnalysis) {
      setEmbeddedViewVisibility("hidden")
    } else {
      loadRequestedAnalysis()
    }
  }, [activeAnalysis, activeAnalysisType, requestedAnalysis, loadRequestedAnalysis])

  switch (activeAnalysisType) {
    case "sky-component":
      return <SkyComponent />
    case "wind":
      return <Wind />
    case "sun":
      return <Sun />
    case "noise":
      return <Noise />
    case "solar-panel":
      return <SolarPanel />
    case "area-metrics":
      return (
        <StackBasedErrorBoundary stackPath={"key-figures-v2"}>
          <KeyFigures imperial={isImperial} />
        </StackBasedErrorBoundary>
      )
    case "microclimate":
      return <Microclimate />
    case "analyses-extensions":
      return (
        <>
          {embeddedViewVisibility === "hidden" && (
            <weave-progress style={{ color: "#ffffff", height: "100%", top: "50%" }} size="m" />
          )}
          <AnalysesExtensionsComponent
            analysis={activeAnalysis!}
            embeddedViewVisibility={embeddedViewVisibility}
            closeEmbeddedView={loadRequestedAnalysis}
          />
        </>
      )
    case "embodied-carbon":
      return <EmbodiedCarbonAnalysis />
    case "operational-carbon":
      return <OperationalCarbonAnalysis />
    default:
      return null
  }
}
