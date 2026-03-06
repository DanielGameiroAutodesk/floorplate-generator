import ElementStateValidationBanner from "src/app/components/ElementStateValidationBanner/ElementStateValidationBanner"
import { PROJECT_ID } from "src/core/project/project"
import { ViewOnlyBanner } from "src/integrations/view-only-banner/ViewOnlyBanner"
import { Layout } from "src/app/layout/AppLayout"
import LeftMenu from "src/integrations/left-menu/LeftMenu"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { Toolbars } from "src/app/toolbars/Toolbars"
import SceneToolsToolbar from "src/integrations/SceneToolsToolbar/SceneToolsToolbar"
import GuideText from "src/integrations/GuideText/GuideText"
import { SavingIndicator } from "src/core/elements-saving/SavingIndicator"
import SiteStudyPicker from "src/integrations/building-systems-site-study/SiteStudyPicker"
import RightMenu from "src/app/components/RightMenu/RightMenu"
import HelpPanel from "src/lib/components/HelpPanel"
import { Suspense } from "react"
import EditBase from "src/app/components/EditBase/EditBase"
import { DebugUI } from "src/app/debug-ui/DebugUI"
import ResourcesModal from "src/integrations/resources-modal/ResourcesModal"
import Attribution from "src/integrations/attribution/Attribution"
import { useRecoilValue } from "recoil"
import { placeModeVisualsActiveState } from "src/integrations/tools-common/PlaceMode/placeModeVisualHook"
import { sidebarsCollapsedState } from "src/integrations/sidebar/sidebarsState"
import { Sun } from "src/integrations/sun/Sun"
import { ToggleSideBarsHotkey } from "src/integrations/tools-common/ToggleSideBarsHotkey"
import ToolWrapper from "src/integrations/tools-common/ToolWrapper"
import Terrain from "src/app/terrain/Terrain"
import { Renderables } from "src/app/Renderables"
import { LineBuildings } from "src/integrations/building-systems-line-buildings/LineBuildings"
import { BasicHandles } from "src/integrations/basic-elements/tooling/BasicHandles"
import useMousePosition from "src/core/useMousePosition"
import { useRightClicker } from "src/integrations/tools-common/UseRightClicker"
import SiteStudyTransparentGradientBackground from "src/integrations/building-systems-site-study/SiteStudyTransparentGradientBackground"
import WSMModelTreeWrapper from "src/integrations/wsm-tools/wsm-integration/WSMModelTreeWrapper"
import { QuickAccessButton, QuickAccessConditionalRender } from "./hotkeys/QuickAccess"
import useFeatureFlag, { ExternalURLFlag, URLFlag } from "src/lib/featureToggling"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import Sync from "./Sync"
import HUD from "src/integrations/hud/HUD"
import { TemplateUpdatesChecker } from "src/integrations/composition-housing/templateUpdates"
import { useEffect } from "preact/hooks"
import { refreshTemplateState } from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import { SettingsButtonWithPosition } from "src/integrations/left-menu/ProjectSettings"
import DesignModeNavbar from "./navbar/DesignModeNavbar"
import I3DSSceneControls from "src/integrations/wsm-tools/wsr/integrated/components/SceneControls/SceneControls"
import { GeometryAlerts } from "src/integrations/geometry-alerts/GeometryAlerts"
import { PerformanceStatsModal } from "src/core/elements/derived-data/stats/PerformanceStatsModal"
import { useInitializeFormitCoreCallback } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { AdskAppStore } from "src/integrations/extensions/Extensions"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { formaUnitsInitializedSignal } from "src/lib/forma-units"
import { toolAPI } from "src/core/toolsState"
import { RecoveryConfirm } from "src/integrations/wsm-tools/wsr/dialogs/RecoveryConfirm"
import { DetectAndRepair3DSCorruptedElements } from "src/integrations/wsm-tools/wsr/dialogs/DetectAndRepair3DSCorruptedElements"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useSignal, useSignalEffect } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { NewTerrain } from "src/app/terrain/NewTerrain"
import AutomatedOnboarding from "src/integrations/automated-onboarding/AutomatedOnboarding"
import { isInScenarioSignal } from "src/integrations/Scenarios/scenarioSelectors"
import { loadScenario } from "src/integrations/Scenarios/scenario"
import SelectTutorialContainer from "src/integrations/tutorial/SelectTutorialContainer"
import { DemoProfilingSuccessModal } from "src/integrations/demo/demo-profiling-success-modal/DemoProfilingSuccessModal"
import { ScenarioRenderables3d } from "src/integrations/Scenarios/ScenarioRenderables3d"

const UtilsComponent = () => {
  useMousePosition()
  useRightClicker()
  return null
}

export const MainApp = () => {
  const isInScenario = isInScenarioSignal.value
  const enableScenarios = isInScenario
  return (
    <>
      <Sun />
      <UtilsComponent />
      <ToggleSideBarsHotkey />
      <ToolWrapper />
      {enableScenarios ? <NewTerrain /> : <Terrain />}
      <Renderables />
      {isInScenario && <ScenarioRenderables3d />}
      <LineBuildings />
      <BasicHandles />
    </>
  )
}

export default function MainMode() {
  const placeModeActive = useRecoilValue(placeModeVisualsActiveState)
  const initialized = isAppInitializedSignal.value
  const sidebarsCollapsed = useRecoilValue(sidebarsCollapsedState)
  const formaUnitsInitialized = formaUnitsInitializedSignal.value
  const showWSMDebug = useFeatureFlag(URLFlag.WSMDebug)
  const performanceStats = useFeatureFlag(ExternalURLFlag.PerformanceStats)
  const inI3DSMode = toolAPI.currentToolSignal.value.id == "WSRAPITool"
  const initializeFormItCore = useInitializeFormitCoreCallback()

  useSignalEffect(() => {
    const canEditProposal = canEditProposalSignal.value
    const formaToastCssImport = async () => {
      if (canEditProposal) {
        await import("src/lib/forma-toasts/forma-toast-override-editor.css")
      } else {
        await import("src/lib/forma-toasts/forma-toast-override-viewer.css")
      }
    }
    void formaToastCssImport()
  })
  useSignalEffect(() => {
    if (!isAppInitializedSignal.value) return
    if (isInScenarioSignal.value) {
      void loadScenario()
    }
  })
  useEffect(() => {
    if (initialized) {
      refreshTemplateState()
    }
  }, [initialized])

  // Initialize formit core, but not until giving startup a bit more time to refresh the screen.
  // So by the time a tool that needs formit or wsm is fired, the load is complete. If not
  // tools will wait for it
  useEffect(() => {
    if (initialized) {
      setTimeout(() => {
        void initializeFormItCore()
      }, 5000) // 5 second wait until formit initializes
    }
  }, [initialized, initializeFormItCore])

  const lastTrackedProposalIdSignal = useSignal<string>()

  useSignalEffect(() => {
    // Subscribe to the signals we want to react to
    if (!isAppInitializedSignal.value) return
    const currentProposalId = elementState.currentProposalIdSignal.value

    const trackProposalLoad = (proposalId: string) => {
      try {
        // If the proposal ID hasn't changed, don't track again
        if (lastTrackedProposalIdSignal.peek() === proposalId) return
        lastTrackedProposalIdSignal.value = proposalId
      } catch (e) {
        console.error("Could not track proposal load", e)
      }
    }

    trackProposalLoad(currentProposalId)
  })

  return (
    <>
      <style>{`
        .no-margin-padding-clear,
        .no-margin-padding-clear * {
          margin: revert-layer;
          padding: revert-layer;
        }

        /* Fix GeometryAlerts spacing in I3DS mode */
        .bottom-main-toolbar-container.i3ds-mode .geometry-alerts-wrapper {
          margin-right: 8px;
        }
      `}</style>
      <DesignModeNavbar />
      <SiteStudyTransparentGradientBackground />
      <ElementStateValidationBanner />
      <>
        <forma-license-banner className="forma-grid-banner" project-id={PROJECT_ID}></forma-license-banner>
        {initialized && <ViewOnlyBanner />}
      </>

      <Layout.Main>
        <HUD />
        <QuickAccessConditionalRender />
        <IfEditAccess>{!placeModeActive ? <Toolbars /> : <></>}</IfEditAccess>

        {initialized && (
          <div
            className="bottom-main"
            style={{
              flexDirection: "column",
              pointerEvents: "none",
              alignItems: "normal",
            }}
          >
            <SiteStudyPicker />
            <div
              className={inI3DSMode ? "bottom-main-toolbar-container i3ds-mode" : "bottom-main-toolbar-container"}
              style={{
                pointerEvents: "none",
                zIndex: "calc(var(--z-primary-navigation) + 30)",
                display: "flex",
                flexDirection: "row-reverse",
                justifyContent: "space-between",
              }}
            >
              {!placeModeActive && !inI3DSMode && <SceneToolsToolbar />}
              {inI3DSMode && <I3DSSceneControls />}
              <GuideText />
              <div></div>
              <SavingIndicator />
              <div className="geometry-alerts-wrapper">
                <GeometryAlerts />
              </div>
            </div>
          </div>
        )}
      </Layout.Main>

      <Layout.LeftMenu>
        <LeftMenu initialized={initialized} />
      </Layout.LeftMenu>

      <Layout.RightMenu>{initialized ? <RightMenu /> : null}</Layout.RightMenu>
      {!(sidebarsCollapsed?.right ?? true) && <HelpPanel is3dSketch={false} />}
      {initialized && formaUnitsInitialized && (
        <Suspense fallback={null}>
          <MainApp />
        </Suspense>
      )}
      {initialized && <EditBase />}
      <DebugUI />
      {showWSMDebug && <WSMModelTreeWrapper />}

      {initialized && <ResourcesModal />}
      {initialized && <Attribution />}

      {/* Confirmation modal for 3d sketch recovery */}
      {initialized && <RecoveryConfirm />}

      {/* Detection and messaging for repairing 3DS corrupted elements */}
      {initialized && <DetectAndRepair3DSCorruptedElements />}

      <QuickAccessButton />
      <SettingsButtonWithPosition />
      {initialized && <Sync createNewProposal={ProposalClientV3.create} />}
      {initialized && <TemplateUpdatesChecker />}
      {initialized && performanceStats && <PerformanceStatsModal />}
      <AdskAppStore />
      {initialized && <AutomatedOnboarding />}
      {initialized && <DemoProfilingSuccessModal />}
      {initialized && <SelectTutorialContainer />}
    </>
  )
}
