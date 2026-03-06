import { activeAnalysisSignal } from "src/integrations/analyses/analysis-state"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { Divider } from "src/integrations/analyses/Divider"
import { runAutomatedOnboardingSignal } from "src/integrations/automated-onboarding/automatedOnboardingState"

export const CatalogPreviewComponent = ({
  variant = "DEFAULT",
  showDivider = false,
}: {
  variant?: "DEFAULT" | "NO-BORDER"
  showDivider?: boolean
}) => {
  const activeAnalysis = activeAnalysisSignal.value
  const rootElementUrn = elementState.currentSnapshot.value.rootUrn
  const elementUrnPrefix = rootElementUrn.substring(0, rootElementUrn.lastIndexOf(":"))

  if (!activeAnalysis) return null

  const onItemClickWithAnalysisModal = (e: CustomEvent) => {
    e.preventDefault()
    window.dispatchEvent(
      new CustomEvent("open-analysis", {
        detail: e.detail,
      }),
    )
  }

  return (
    <StackBasedErrorBoundary stackPath={"forma-analysis-catalog"}>
      <div style={{ marginTop: "12px" }}>
        {showDivider && <Divider gapLeft gapRight />}
        <forma-analysis-catalog-preview
          onItemClick={onItemClickWithAnalysisModal}
          authContext={PROJECT_ID}
          elementUrnPrefix={elementUrnPrefix}
          typeFilter={[activeAnalysis]}
          variant={variant}
          data-tutorial-target="sun-analysis-open-results"
          showGuideTooltip={runAutomatedOnboardingSignal.value}
        />
      </div>
    </StackBasedErrorBoundary>
  )
}
