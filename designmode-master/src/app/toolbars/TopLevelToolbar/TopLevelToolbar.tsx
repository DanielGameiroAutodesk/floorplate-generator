import { LimitsToolbar } from "src/integrations/basic-elements/draw/Limits/LimitsToolbar"
import { GeneratorsToolbar } from "src/integrations/Toolbars/CoreToolbar/domain/generators/GeneratorsToolbar"
import { VegetationToolbar } from "src/integrations/basic-elements/draw/Vegetation/VegetationToolbar"
import { BuildingToolbar } from "src/integrations/Toolbars/CoreToolbar/domain/building/BuildingToolbar"
import { Suspense } from "preact/compat"
import { TransportationToolbar } from "src/integrations/basic-elements/draw/Transportation/TransportationToolbar"
import { GenericTools } from "src/integrations/basic-elements/draw/Generic/GenericTools"
import { useRepeatLastToolHotkey } from "./repeat-last-tool-hotkey"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"
import Integrated3DSketchSketchModeButton from "src/integrations/wsm-tools/wsr/toolbars/Integrated3DSketchToolbar"
import { WSRMeasureToolButton } from "src/integrations/wsm-tools/wsr/WSRMeasureToolbar"
import { LabelToolbar } from "src/integrations/labels/LabelTool/LabelToolbar"
import { ContextualToolbar, useShouldShowContextualToolbar } from "src/app/toolbars/ContextualToolbar"
import { SectionBoxToolbar } from "src/integrations/section-box/tooling/toolbar/SectionBoxToolbar"
import { selectedSectionBoxSignal } from "src/integrations/section-box/state"
import { IterativeExploreToolbar } from "src/integrations/building-systems-site-study/iterative"
import { ImportToolbar } from "src/integrations/import/ImportToolbar"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import ToolbarButton from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import GlobeIcon_16 from "src/lib/components/icons/GlobeIcon_16"
import { showContextualDataModal } from "src/integrations/Scenarios/contextual-data/MarketPlace"

export default function TopLevelToolbar() {
  useRepeatLastToolHotkey()
  const shouldShowContextualToolbar = useShouldShowContextualToolbar()
  const funFlag = useFeatureFlag(URLFlag.Fun)

  return (
    <>
      <IterativeExploreToolbar />
      <BuildingToolbar />
      <VegetationToolbar />
      <LimitsToolbar />
      <TransportationToolbar />
      <GenericTools />
      <Integrated3DSketchSketchModeButton />
      <WSRMeasureToolButton />
      <LabelToolbar />
      <ImportToolbar />
      {funFlag && (
        <ToolbarButton
          icon={<GlobeIcon_16 />}
          onClick={() => void showContextualDataModal()}
          label={() => "Contextual Data"}
        />
      )}
      <Suspense fallback={null}>
        <GeneratorsToolbar />
      </Suspense>
      {shouldShowContextualToolbar && (
        <>
          <FormaToolbarDivider direction="vertical" />
          <ContextualToolbar />
        </>
      )}
      {!shouldShowContextualToolbar && selectedSectionBoxSignal.value && (
        <>
          <FormaToolbarDivider direction="vertical" />
          <SectionBoxToolbar />
        </>
      )}
    </>
  )
}
