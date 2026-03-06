import { Suspense } from "preact/compat"
import AnalysisMenu from "src/integrations/analyses/AnalysisMenu/AnalysisMenu"
import { PropertiesHeader } from "src/integrations/VisualProperties/PropertiesHeader"
import menuStyles from "./RightMenu.module.pcss"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { PendingOperationPopup } from "src/integrations/PendingOperation/PendingOperationPopup"
import CheckPropertiesEdibilityWrapper from "src/integrations/tools-common/EditBaseHelp/CheckPropertiesEdibilityWrapper"
import { Analyses } from "src/integrations/analyses/Triggers/Triggers"
import { DefaultPropertyPanel } from "./DefaultPropertyPanel"
import { toolAPI } from "src/core/toolsState"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"
import {
  useIntegrated3DSketchAPI,
  wsmLevelChangedPayload,
} from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { KeyFigures } from "src/integrations/analyses/AreaMetrics/KeyFigures"
import { FloorPlansMenu3dSketchBuilding } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingWrapper"
import { useRecoilValue } from "recoil"
import { isCurrentI3DSPathBuilding } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { BasicBuildingDuplicate } from "src/integrations/building-design-detailedbuilding/CopyStuffForProjects"
import { useIsImperial } from "src/lib/unitSettings"
import { isAnythingSelectedSignal } from "src/core/selection/selectionState"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "rainwater-flow-analysis-trigger": {
        rootElementUrn: string
        disabled?: boolean
        tooltip?: string
      }
      "forma-analysis-catalog-preview": {
        onItemClick: ((e: CustomEvent) => void) | undefined
        authContext: string
        elementUrnPrefix: string
        typeFilter?: string[]
        variant?: "DEFAULT" | "NO-BORDER"
        showGuideTooltip?: boolean
      }
    }
  }
}

export default function RightMenu() {
  const arne = useFeatureFlag(URLFlag.Arne)
  const i3dsAPI = useIntegrated3DSketchAPI()
  const inI3DSMode = i3dsAPI.inI3DSMode && !i3dsAPI.isEditingConstraint

  // Rerenders this component to show/hide Area Metrics (KeyFigures) when levels are applied/removed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const wsmLevelsChanged = useRecoilValue(wsmLevelChangedPayload)

  const imperial = useIsImperial()

  const formitInitialized = formitInitializedSignal.value
  const is3DSBuilding = formitInitialized && isCurrentI3DSPathBuilding()

  return (
    <div className={menuStyles.RightMenuContent}>
      <Suspense fallback={null}>
        <>
          {!inI3DSMode && (
            <section>
              <StackBasedErrorBoundary stackPath={"forma-analysis-menu"}>
                <AnalysisMenu allowUntoggle={isAnythingSelectedSignal.value} />
              </StackBasedErrorBoundary>
              <Analyses />
            </section>
          )}
          {/* Show area metrics when editing a building in 3d sketch */}
          {inI3DSMode && is3DSBuilding && (
            <section>
              <StackBasedErrorBoundary stackPath={"key-figures-v2"}>
                <KeyFigures imperial={imperial} />
              </StackBasedErrorBoundary>
            </section>
          )}
          <PendingOperationPopup />
          <section data-tutorial-target="element-properties">
            <PropertiesHeader />
            <CheckPropertiesEdibilityWrapper>
              {toolAPI.currentToolSignal.value.propertyPanel === "default" ? (
                <DefaultPropertyPanel />
              ) : (
                <toolAPI.currentToolSignal.value.propertyPanel />
              )}
            </CheckPropertiesEdibilityWrapper>
          </section>
          {/* Show floor plans when editing in 3d sketch */}
          {inI3DSMode && is3DSBuilding && (
            <section>
              <FloorPlansMenu3dSketchBuilding />
            </section>
          )}
          {arne && <BasicBuildingDuplicate />}
        </>
      </Suspense>
    </div>
  )
}
