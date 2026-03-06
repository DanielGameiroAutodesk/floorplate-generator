import { Suspense } from "react"
import { useEffect } from "preact/hooks"
import { MainApp } from "src/app/modes/MainMode/MainMode"
import { KeyFigures } from "src/integrations/analyses/AreaMetrics/KeyFigures"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import { activeAnalysisSignal } from "src/integrations/analyses/analysis-state"
import { Analytics, AnalyticsLegacy } from "src/core/analytics"
import { AnalysesExtensionsComponent } from "src/integrations/analyses/Triggers/Triggers"
import { assertNever } from "src/lib/assertNever"
import type { Extends } from "src/lib/typeUtils"
import { EmbeddedViewPlacement, useInstallationsWithExtension } from "src/integrations/extensions/extension-service"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { formaUnitsInitializedSignal } from "src/lib/forma-units"
import { EmbodiedCarbonAnalysis } from "src/integrations/analyses/EmbodiedCarbonAnalysis/EmbodiedCarbonAnalysis"
import { useIsImperial } from "src/lib/unitSettings"
import SceneToolsToolbar from "src/integrations/SceneToolsToolbar/SceneToolsToolbar"
import { ViewAnalysisLayout } from "./ViewAnalysisLayout"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"

type Mode = "viewAnalysis" | "compare"
type SupportedAnalysisType = Extends<
  AnalysisType,
  "area-metrics" | "embodied-carbon" | `analyses-extensions:${string}:${number}`
>

function useSupportedAnalysisType(analysisTypeString: string | null): SupportedAnalysisType | null {
  const installationsWithExtension = useInstallationsWithExtension()

  if (!analysisTypeString || analysisTypeString === "area-metrics") {
    return "area-metrics"
  } else if (analysisTypeString === "embodied-carbon") {
    return "embodied-carbon"
  } else if (analysisTypeString.startsWith("extension:")) {
    const [, extensionId] = analysisTypeString.split(":")
    const { extension } = installationsWithExtension?.find((it) => it.extension.id === extensionId) ?? {}
    const embeddedViewIndex = extension?.resources.embeddedViews?.findIndex(
      (view) => view.placement === EmbeddedViewPlacement.RIGHT_MENU_ANALYSIS_PANEL,
    )
    if (embeddedViewIndex == null) {
      return null
    }
    return `analyses-extensions:${extensionId}:${embeddedViewIndex}`
  }
  return null
}

function isAnalysesExtensions(analysisType: AnalysisType): analysisType is `analyses-extensions:${string}:${number}` {
  return analysisType.startsWith("analyses-extensions")
}

function AnalysisPanel({ analysisType, mode }: { mode: Mode; analysisType: SupportedAnalysisType }) {
  const t = useTranslator()
  const imperial = useIsImperial()
  useEffect(() => {
    const timer = setTimeout(() => {
      Analytics.track(
        EventName.View,
        {
          feature_category: FeatureCategory.Analysis,
          feature: "analysis_panel",
        },
        {
          view_duration: 10,
          view_type: mode,
          analysis_type: analysisType,
        },
      )
      AnalyticsLegacy.track("Analysis Submode: Analysis result - View 10 s", {
        viewType: mode,
        analysisType,
      }) // use naming convention for decision support analytics
    }, 10000)
    return () => clearTimeout(timer)
  }, [analysisType, mode])

  // Set active analysis to enable function coloring
  useEffect(() => {
    activeAnalysisSignal.value = analysisType
  }, [analysisType])

  if (analysisType === "area-metrics") {
    return <KeyFigures imperial={imperial} />
  } else if (analysisType === "embodied-carbon") {
    return <EmbodiedCarbonAnalysis />
  } else if (isAnalysesExtensions(analysisType)) {
    const analysisId = new URLSearchParams(window.location.search).get("analysisId")
    if (analysisId == null) {
      return <>{t(($) => $.viewAnalysis.errors.noAnalysisId)}</>
    }
    return <AnalysesExtensionsComponent analysis={analysisType} analysisId={analysisId} />
  }

  assertNever(analysisType)
}

export default function ViewAnalysisMode({ mode }: { mode: Mode }) {
  const t = useTranslator()
  const initialized = isAppInitializedSignal.value
  const formaUnitsInitialized = formaUnitsInitializedSignal.value
  const analysisTypeParam = new URLSearchParams(window.location.search).get("analysisType")
  const analysisType = useSupportedAnalysisType(analysisTypeParam)

  useEffect(() => {
    if (!initialized) {
      window.globalSpinner.start()
    } else {
      window.globalSpinner.stop()
    }
  }, [initialized])

  return initialized && formaUnitsInitialized ? (
    <>
      <ViewAnalysisLayout.RightMenu>
        {analysisType == null ? (
          t(($) => $.viewAnalysis.errors.unsupportedAnalysisType, { type: analysisTypeParam ?? "" })
        ) : (
          <AnalysisPanel mode={mode} analysisType={analysisType} />
        )}
      </ViewAnalysisLayout.RightMenu>

      <ViewAnalysisLayout.Main>
        <ViewAnalysisLayout.BottomContainer minWidthThreshold={460}>
          {analysisType !== "area-metrics" && <SceneToolsToolbar />}
        </ViewAnalysisLayout.BottomContainer>
      </ViewAnalysisLayout.Main>

      <Suspense fallback={null}>
        <MainApp />
      </Suspense>
    </>
  ) : null
}
